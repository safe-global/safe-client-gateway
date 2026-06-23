// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import configuration from '@/config/entities/__tests__/configuration';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { SurveysController } from '@/modules/surveys/routes/surveys.controller';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

const ONBOARDING_SLUG = 'onboarding';
const USE_CASES_PAGE = 'use_cases';

describe('SurveysController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let postgresDatabaseService: PostgresDatabaseService;

  beforeAll(async () => {
    vi.resetAllMocks();

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
    postgresDatabaseService = moduleFixture.get(PostgresDatabaseService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Inserts a user, wallet, space, and an ADMIN/ACTIVE Member row directly
   * via TypeORM repositories, then signs a JWT whose `sub` matches the
   * auto-incremented user id. This avoids going through `/v1/users/wallet`
   * + `/v1/spaces`, which would otherwise produce a JWT whose random
   * faker-generated sub doesn't line up with the real user id — the source
   * of the cross-suite flakiness when this spec runs in CI's parallel
   * integration runner alongside other tests that pollute the user table.
   */
  async function seedAdminWithSpace(): Promise<{
    accessToken: string;
    spaceId: number;
    spaceUuid: string;
    userId: number;
    signerAddress: `0x${string}`;
  }> {
    const userRepo = await postgresDatabaseService.getRepository(User);
    const walletRepo = await postgresDatabaseService.getRepository(Wallet);
    const spaceRepo = await postgresDatabaseService.getRepository(Space);
    const memberRepo = await postgresDatabaseService.getRepository(Member);

    const userInsert = await userRepo.insert({ status: 'ACTIVE' });
    const userId = userInsert.identifiers[0].id as number;

    const signerAddress = getAddress(faker.finance.ethereumAddress());
    await walletRepo.insert({
      user: { id: userId } as User,
      address: signerAddress,
    });

    const spaceInsert = await spaceRepo.insert({
      name: nameBuilder(),
      status: 'ACTIVE',
    });
    const spaceId = spaceInsert.identifiers[0].id as number;
    // uuid is filled by the DB default (gen_random_uuid()), so read it back.
    const space = await spaceRepo.findOneByOrFail({ id: spaceId });
    const spaceUuid = space.uuid;

    await memberRepo.insert({
      user: { id: userId } as User,
      space: { id: spaceId } as Space,
      name: faker.person.firstName(),
      alias: null,
      role: 'ADMIN',
      status: 'ACTIVE',
      invitedBy: null,
    });

    const accessToken = jwtService.sign(
      siweAuthPayloadDtoBuilder()
        .with('sub', String(userId))
        .with('signer_address', signerAddress)
        .build(),
    );

    return { accessToken, spaceId, spaceUuid, userId, signerAddress };
  }

  /**
   * Inserts a user + wallet but no Member relation, so this user is not a
   * member of any space. JWT sub matches the user id.
   */
  async function seedOutsider(): Promise<{
    accessToken: string;
    userId: number;
  }> {
    const userRepo = await postgresDatabaseService.getRepository(User);
    const walletRepo = await postgresDatabaseService.getRepository(Wallet);

    const userInsert = await userRepo.insert({ status: 'ACTIVE' });
    const userId = userInsert.identifiers[0].id as number;

    const signerAddress = getAddress(faker.finance.ethereumAddress());
    await walletRepo.insert({
      user: { id: userId } as User,
      address: signerAddress,
    });

    const accessToken = jwtService.sign(
      siweAuthPayloadDtoBuilder()
        .with('sub', String(userId))
        .with('signer_address', signerAddress)
        .build(),
    );

    return { accessToken, userId };
  }

  it('should require authentication for every endpoint', () => {
    const endpoints = Object.values(SurveysController.prototype) as Array<
      (...args: Array<unknown>) => unknown
    >;
    for (const fn of endpoints) {
      checkGuardIsApplied(AuthGuard, fn);
    }
  });

  describe('GET /v1/spaces/:spaceId/surveys/:slug/state', () => {
    it('returns survey definition with null surveyResponse when admin has not submitted', async () => {
      const { accessToken, spaceUuid } = await seedAdminWithSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/state`)
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
          expect(body.surveyResponse).toBeNull();
        });
    });

    it('returns surveyResponse after admin submits', async () => {
      const { accessToken, spaceUuid } = await seedAdminWithSpace();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          selections: { [USE_CASES_PAGE]: ['hold_assets', 'run_payments'] },
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/state`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.surveyResponse).toEqual(
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
      const { spaceUuid } = await seedAdminWithSpace();
      const { accessToken: outsiderToken } = await seedOutsider();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/state`)
        .set('Cookie', [`access_token=${outsiderToken}`])
        .expect(403);
    });

    it('returns 404 for unknown slug', async () => {
      const { accessToken, spaceUuid } = await seedAdminWithSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/surveys/no-such-survey/state`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404);
    });

    it('rejects a numeric space id with 400', async () => {
      const { accessToken, spaceId } = await seedAdminWithSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/surveys/${ONBOARDING_SLUG}/state`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400);
    });
  });

  describe('POST /v1/spaces/:spaceId/surveys/:slug/responses', () => {
    it('admin submits then re-submits, upserting selections and bumping updated_at', async () => {
      const { accessToken, spaceUuid } = await seedAdminWithSpace();

      const first = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: { [USE_CASES_PAGE]: ['hold_assets'] } })
        .expect(201);

      expect(first.body).toEqual(
        expect.objectContaining({
          spaceUuid,
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
        .post(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/responses`)
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
      const { accessToken, spaceUuid } = await seedAdminWithSpace();

      // Inner `z.array(...).min(1)` fires in ValidationPipe → 422.
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: { [USE_CASES_PAGE]: [] } })
        .expect(422);
    });

    it('returns 422 when selections is an empty object', async () => {
      const { accessToken, spaceUuid } = await seedAdminWithSpace();

      // Empty `{}` is caught by the Zod schema's `.refine` (non-empty map),
      // so it surfaces as 422 from ValidationPipe rather than reaching the
      // service-level "Missing answers for page(s)" check.
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: {} })
        .expect(422);
    });

    it('returns 400 for an unknown page id', async () => {
      const { accessToken, spaceUuid } = await seedAdminWithSpace();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ selections: { not_a_real_page: ['hold_assets'] } })
        .expect(400);
    });

    it('returns 400 for unknown selection keys within a page', async () => {
      const { accessToken, spaceUuid } = await seedAdminWithSpace();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          selections: {
            [USE_CASES_PAGE]: ['hold_assets', 'totally_made_up_key'],
          },
        })
        .expect(400);
    });

    it('returns 403 for non-admin users', async () => {
      const { spaceUuid } = await seedAdminWithSpace();
      const { accessToken: outsiderToken } = await seedOutsider();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/responses`)
        .set('Cookie', [`access_token=${outsiderToken}`])
        .send({ selections: { [USE_CASES_PAGE]: ['hold_assets'] } })
        .expect(403);
    });

    it('rejects requests without an access token', async () => {
      const { spaceUuid } = await seedAdminWithSpace();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceUuid}/surveys/${ONBOARDING_SLUG}/responses`)
        .send({ selections: { [USE_CASES_PAGE]: ['hold_assets'] } })
        .expect((res) => {
          expect([401, 403]).toContain(res.status);
        });
    });
  });
});
