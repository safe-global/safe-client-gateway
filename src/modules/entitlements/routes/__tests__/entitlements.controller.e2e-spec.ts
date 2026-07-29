// SPDX-License-Identifier: FSL-1.1-MIT

import { type Server } from 'node:http';
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
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { FeatureKeys } from '@/modules/entitlements/domain/entities/feature.entity';
import { EntitlementsController } from '@/modules/entitlements/routes/entitlements.controller';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

// Seeded Free-tier defaults (see the seed-features migration).
const FREE_SAFE_SEATS = 10;
const FREE_MEMBERS = 5;

describe('EntitlementsController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;

  beforeAll(async () => {
    vi.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
        billingService: true,
      },
      billing: {
        ...defaultConfiguration.billing,
        webhook: {
          ...defaultConfiguration.billing.webhook,
          publicKey: 'dummy-public-key',
        },
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      guards: [
        {
          originalGuard: SpacesCreationRateLimitGuard,
          testGuard: {
            canActivate: (): true => true,
          },
        },
      ],
      modules: [
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    jwtService = moduleFixture.get<IJwtService>(IJwtService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerUser(): Promise<{ accessToken: string }> {
    // Register with a bootstrap token, then re-sign with the REAL user id as
    // `sub` so authorization checks are deterministic (the builder's random
    // single-digit sub may collide with unrelated users in the shared DB).
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const bootstrapToken = jwtService.sign(authPayloadDto);
    const registration = await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [`access_token=${bootstrapToken}`]);
    const accessToken = jwtService.sign({
      ...authPayloadDto,
      sub: String(registration.body.id),
    });
    return { accessToken };
  }

  async function registerAndCreateSpace(): Promise<{
    accessToken: string;
    spaceId: string;
  }> {
    const { accessToken } = await registerUser();
    const createSpaceResponse = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: nameBuilder() });
    return { accessToken, spaceId: createSpaceResponse.body.uuid };
  }

  function buildSafes(
    count: number,
  ): Array<{ chainId: string; address: string }> {
    return Array.from({ length: count }, () => ({
      chainId: '1',
      address: getAddress(faker.finance.ethereumAddress()),
    }));
  }

  it('applies the AuthGuard to every endpoint', () => {
    checkGuardIsApplied(AuthGuard, EntitlementsController);
  });

  describe('GET /v1/spaces/:spaceId/entitlements', () => {
    it('returns the Free-branch contract for a fresh workspace', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/entitlements`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.plan).toBeNull();
          expect(body.overSeatSafes).toStrictEqual([]);
          expect(
            new Set(
              body.entitlements.map(
                (entitlement: { feature: string }) => entitlement.feature,
              ),
            ),
          ).toStrictEqual(new Set(FeatureKeys));

          const seats = body.entitlements.find(
            (entitlement: { feature: string }) =>
              entitlement.feature === 'safe_seats',
          );
          expect(seats).toStrictEqual({
            feature: 'safe_seats',
            type: 'metered',
            enabled: true,
            quota: FREE_SAFE_SEATS,
            used: 0,
            resetsAt: null,
            grandfathered: false,
          });
          const members = body.entitlements.find(
            (entitlement: { feature: string }) =>
              entitlement.feature === 'members',
          );
          // The creating admin holds a seat.
          expect(members).toMatchObject({ quota: FREE_MEMBERS, used: 1 });
        });
    });

    it('reflects Safe additions in the seat usage', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: buildSafes(3) })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/entitlements`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          const seats = body.entitlements.find(
            (entitlement: { feature: string }) =>
              entitlement.feature === 'safe_seats',
          );
          expect(seats).toMatchObject({ used: 3 });
        });
    });

    it('returns 403 for anonymous requests', async () => {
      const { spaceId } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/entitlements`)
        .expect(403);
    });

    it('returns 403 for non-members', async () => {
      const { spaceId } = await registerAndCreateSpace();
      const { accessToken: otherAccessToken } = await registerUser();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/entitlements`)
        .set('Cookie', [`access_token=${otherAccessToken}`])
        .expect(403);
    });

    it('returns 400 for a malformed spaceId', async () => {
      const { accessToken } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .get('/v1/spaces/not-a-uuid/entitlements')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400);
    });
  });

  describe('402 QUOTA_EXCEEDED enforcement', () => {
    it('rejects adding Safes past the seat quota with the typed error body', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: buildSafes(FREE_SAFE_SEATS + 1) })
        .expect(402)
        .expect(({ body }) => {
          expect(body).toStrictEqual({
            code: 'QUOTA_EXCEEDED',
            message: expect.stringContaining('safe_seats'),
            statusCode: 402,
            feature: 'safe_seats',
            quota: FREE_SAFE_SEATS,
            used: 0,
            resetsAt: null,
          });
        });
    });

    it('rejects inviting members past the member quota with the typed error body', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();
      const invites = Array.from({ length: FREE_MEMBERS }, () => ({
        type: 'wallet',
        address: getAddress(faker.finance.ethereumAddress()),
        role: 'MEMBER',
        name: nameBuilder(),
      }));

      // The creating admin already holds a seat → 5 more exceed the quota.
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ users: invites })
        .expect(402)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            code: 'QUOTA_EXCEEDED',
            feature: 'members',
            quota: FREE_MEMBERS,
          });
        });

      // One fewer fits.
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/members/invite`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ users: invites.slice(0, FREE_MEMBERS - 1) })
        .expect(201);
    });
  });

  describe('PUT /v1/spaces/:spaceId/entitlements/seat-selection', () => {
    it('returns 403 for non-admins', async () => {
      const { spaceId } = await registerAndCreateSpace();
      const { accessToken: otherAccessToken } = await registerUser();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/entitlements/seat-selection`)
        .set('Cookie', [`access_token=${otherAccessToken}`])
        .send({ safes: [] })
        .expect(403);
    });

    it('accepts an empty selection and returns the recomputed entitlements', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/entitlements/seat-selection`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [] })
        .expect(200)
        .expect(({ body }) => {
          expect(body.plan).toBeNull();
          expect(body.overSeatSafes).toStrictEqual([]);
          expect(body.entitlements).toBeInstanceOf(Array);
        });
    });

    it('returns 422 for Safes outside the workspace', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/entitlements/seat-selection`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: buildSafes(1) })
        .expect(422);
    });

    it('returns 422 for duplicate Safes in the selection', async () => {
      const { accessToken, spaceId } = await registerAndCreateSpace();
      const [safe] = buildSafes(1);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/entitlements/seat-selection`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [safe, safe] })
        .expect(422);
    });
  });
});
