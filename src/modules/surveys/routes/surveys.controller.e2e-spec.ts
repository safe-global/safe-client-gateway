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
const USE_CASES_PAGE = 'use_cases';

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
              title: expect.any(String),
              surveyContent: expect.objectContaining({
                pages: expect.arrayContaining([
                  expect.objectContaining({
                    id: USE_CASES_PAGE,
                    title: 'How will you use Safe?',
                    multiSelect: true,
                    options: expect.arrayContaining([
                      expect.objectContaining({ key: 'hold_assets' }),
                      expect.objectContaining({ key: 'run_payments' }),
                    ]),
                  }),
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
        .send({
          selections: { [USE_CASES_PAGE]: ['hold_assets', 'run_payments'] },
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/state`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.spaceResponse).toEqual(
            expect.objectContaining({
              surveyVersion: 1,
              selections: {
                [USE_CASES_PAGE]: expect.arrayContaining([
                  'hold_assets',
                  'run_payments',
                ]),
              },
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
    it('admin submits then re-submits, upserting selections and bumping updated_at', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      const first = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: { [USE_CASES_PAGE]: ['hold_assets'] } })
        .expect(201);

      expect(first.body).toEqual(
        expect.objectContaining({
          spaceId,
          surveySlug: ONBOARDING_SLUG,
          surveyVersion: 1,
          selections: { [USE_CASES_PAGE]: ['hold_assets'] },
          answeredByUserId: expect.any(Number),
        }),
      );
      // On the initial INSERT both timestamps come from the same statement.
      expect(new Date(first.body.updatedAt).getTime()).toBe(
        new Date(first.body.submittedAt).getTime(),
      );

      // Give the DB clock a tick so the update_updated_at trigger produces a
      // visibly later timestamp.
      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          selections: { [USE_CASES_PAGE]: ['run_payments', 'hold_assets'] },
        })
        .expect(201);

      expect(second.body.selections[USE_CASES_PAGE]).toEqual(
        expect.arrayContaining(['run_payments', 'hold_assets']),
      );
      // submittedAt is locked at INSERT time; updated_at bumps on every UPDATE.
      expect(second.body.submittedAt).toBe(first.body.submittedAt);
      expect(new Date(second.body.updatedAt).getTime()).toBeGreaterThan(
        new Date(first.body.updatedAt).getTime(),
      );
    });

    it('returns 422 for an empty page array (mandatory)', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      // Inner `z.array(...).min(1)` fires in ValidationPipe → 422.
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: { [USE_CASES_PAGE]: [] } })
        .expect(422);
    });

    it('returns 422 when selections is an empty object', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      // Empty `{}` is caught by the Zod schema's `.refine` (non-empty map),
      // so it surfaces as 422 from ValidationPipe rather than reaching the
      // service-level "Missing answers for page(s)" check.
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: {} })
        .expect(422);
    });

    it('returns 400 for an unknown page id', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: { not_a_real_page: ['hold_assets'] } })
        .expect(400);
    });

    it('returns 400 for unknown selection keys within a page', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);
      const spaceId = await registerWalletAndCreateSpace(app, accessToken);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          selections: {
            [USE_CASES_PAGE]: ['hold_assets', 'totally_made_up_key'],
          },
        })
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
        .send({ selections: { [USE_CASES_PAGE]: ['hold_assets'] } })
        .expect(403);
    });

    it('rejects requests without an access token', async () => {
      const adminPayload = siweAuthPayloadDtoBuilder().build();
      const adminToken = jwtService.sign(adminPayload);
      const spaceId = await registerWalletAndCreateSpace(app, adminToken);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/responses`)
        .send({ selections: { [USE_CASES_PAGE]: ['hold_assets'] } })
        .expect((res) => {
          expect([401, 403]).toContain(res.status);
        });
    });
  });
});
