// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import configuration from '@/config/entities/__tests__/configuration';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { SurveysController } from '@/modules/surveys/routes/surveys.controller';

const ONBOARDING_SLUG = 'onboarding';

async function registerWalletAndCreateSpace(
  app: INestApplication<Server>,
  accessToken: string,
): Promise<number> {
  await request(app.getHttpServer())
    .post('/v1/users/wallet')
    .set('Cookie', [`access_token=${accessToken}`])
    .expect(201);

  const res = await request(app.getHttpServer())
    .post('/v1/spaces')
    .set('Cookie', [`access_token=${accessToken}`])
    .send({ name: nameBuilder() })
    .expect(201);

  return res.body.id as number;
}

describe('SurveysController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;

  beforeAll(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      modules: [
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    jwtService = moduleFixture.get<IJwtService>(IJwtService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(SurveysController.prototype) as Array<
      (...args: Array<unknown>) => unknown
    >;
    for (const fn of endpoints) {
      checkGuardIsApplied(AuthGuard, fn);
    }
  });

  describe('GET /v1/spaces/:spaceId/surveys/:slug/state', () => {
    it('returns survey definition with null spaceResponse when admin has not submitted', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/state`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.survey).toEqual(
            expect.objectContaining({
              id: expect.any(Number),
              slug: ONBOARDING_SLUG,
              version: 1,
              title: 'How will you use Safe?',
              subtitle: expect.any(String),
              surveyContent: expect.objectContaining({
                multiSelect: true,
                options: expect.arrayContaining([
                  expect.objectContaining({ key: 'hold_assets' }),
                  expect.objectContaining({ key: 'run_payments' }),
                ]),
              }),
            }),
          );
          expect(body.spaceResponse).toBeNull();
        });
    });

    it('returns spaceResponse after admin submits', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: ['hold_assets', 'run_payments'] })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/state`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.spaceResponse).toEqual(
            expect.objectContaining({
              surveyVersion: 1,
              selections: expect.arrayContaining([
                'hold_assets',
                'run_payments',
              ]),
              answeredByUserId: expect.any(Number),
            }),
          );
        });
    });

    it('returns 403 for users who are not admins of the space', async () => {
      const adminPayload = siweAuthPayloadDtoBuilder().build();
      const adminToken = jwtService.sign(adminPayload);
      const spaceId = await registerWalletAndCreateSpace(app, adminToken);

      const outsiderPayload = siweAuthPayloadDtoBuilder().build();
      const outsiderToken = jwtService.sign(outsiderPayload);
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${outsiderToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/state`)
        .set('Cookie', [`access_token=${outsiderToken}`])
        .expect(403);
    });

    it('returns 404 for unknown slug', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/surveys/no-such-survey/state`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404);
    });
  });

  describe('POST /v1/spaces/:spaceId/surveys/:slug/responses', () => {
    it('admin submits then re-submits, upserting selections', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: ['hold_assets'] })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toEqual(
            expect.objectContaining({
              spaceId,
              surveySlug: ONBOARDING_SLUG,
              surveyVersion: 1,
              selections: ['hold_assets'],
              answeredByUserId: expect.any(Number),
            }),
          );
        });

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: ['run_payments', 'hold_assets'] })
        .expect(201)
        .expect(({ body }) => {
          expect(body.selections).toEqual(
            expect.arrayContaining(['run_payments', 'hold_assets']),
          );
        });
    });

    it('returns 400/422 for empty selections (mandatory)', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: [] })
        .expect((res) => {
          expect([400, 422]).toContain(res.status);
        });
    });

    it('returns 400 for unknown selection keys', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: ['hold_assets', 'totally_made_up_key'] })
        .expect(400);
    });

    it('returns 403 for non-admin users', async () => {
      const adminPayload = siweAuthPayloadDtoBuilder().build();
      const adminToken = jwtService.sign(adminPayload);
      const spaceId = await registerWalletAndCreateSpace(app, adminToken);

      const outsiderPayload = siweAuthPayloadDtoBuilder().build();
      const outsiderToken = jwtService.sign(outsiderPayload);
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${outsiderToken}`])
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${outsiderToken}`])
        .send({ selections: ['hold_assets'] })
        .expect(403);
    });

    it('rejects requests without an access token', async () => {
      const adminPayload = siweAuthPayloadDtoBuilder().build();
      const adminToken = jwtService.sign(adminPayload);
      const spaceId = await registerWalletAndCreateSpace(app, adminToken);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .send({ selections: ['hold_assets'] })
        .expect((res) => {
          expect([401, 403]).toContain(res.status);
        });
    });
  });
});
