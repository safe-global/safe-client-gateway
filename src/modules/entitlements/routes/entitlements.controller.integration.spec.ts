// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getAddress } from 'viem';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import configuration from '@/config/entities/__tests__/configuration';
import { postgresConfig } from '@/config/entities/postgres.config';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import { EntitlementsController } from '@/modules/entitlements/routes/entitlements.controller';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

// The suite owns its own tiny catalog: only `safe_seats` is signed off and
// seeded by a migration, so the feature types below come from fixtures (same
// policy as the service's integration spec). Kept intentionally small — the
// business logic across every feature type is already exhaustively covered
// there; this file only exercises HTTP wiring: guards, status codes, and the
// request/response shape.
const FREE_SAFE_SEATS = 2;

describe('EntitlementsController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let postgresDatabaseService: PostgresDatabaseService;

  // Its own database, not the shared `test-db`: the `features` catalog is a
  // global table, and this suite replaces it wholesale. Sharing an instance
  // with another suite that seeds the same keys is a race.
  const testDatabaseName = faker.string.alpha({ length: 10, casing: 'lower' });

  async function adminQuery(sql: string): Promise<void> {
    const adminDataSource = new DataSource({
      ...postgresConfig({
        ...configuration().db.connection.postgres,
        type: 'postgres',
        database: 'postgres',
      }),
    });
    await adminDataSource.initialize();
    try {
      await adminDataSource.query(sql);
    } finally {
      await adminDataSource.destroy();
    }
  }

  beforeAll(async () => {
    vi.resetAllMocks();

    await adminQuery(`CREATE DATABASE ${testDatabaseName}`);

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      db: {
        ...defaultConfiguration.db,
        connection: {
          ...defaultConfiguration.db.connection,
          postgres: {
            ...defaultConfiguration.db.connection.postgres,
            database: testDatabaseName,
          },
        },
      },
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
    postgresDatabaseService = moduleFixture.get(PostgresDatabaseService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);

    // Booting the app ran the migrations, seed included, so the catalog holds
    // the shipped `safe_seats` row. Clear it in FK-dependency order to leave
    // the fixtures below as the suite's whole catalog.
    await clearFeatureCatalog();
  });

  async function deleteAll<T extends object>(entity: {
    new (): T;
  }): Promise<void> {
    const repository = await postgresDatabaseService.getRepository(entity);
    await repository.createQueryBuilder().delete().execute();
  }

  async function clearFeatureCatalog(): Promise<void> {
    await deleteAll(SpaceFeatureUsage);
    await deleteAll(SubscriptionEntitlement);
    await deleteAll(SpaceSubscription);
    await deleteAll(Feature);
  }

  beforeEach(async () => {
    const featuresRepository =
      await postgresDatabaseService.getRepository(Feature);
    await featuresRepository.insert([
      {
        key: 'security_hub',
        type: FeatureType.Binary,
        description: 'Security Hub',
        freeEnabled: false,
        freeQuota: null,
        freeValue: null,
        freePeriod: null,
      },
      {
        key: 'safe_seats',
        type: FeatureType.Metered,
        description: 'Safe seats',
        freeEnabled: true,
        freeQuota: FREE_SAFE_SEATS,
        freeValue: null,
        freePeriod: null,
      },
    ]);
  });

  afterEach(async () => {
    await clearFeatureCatalog();
  });

  afterAll(async () => {
    await app.close();
    await adminQuery(
      `DROP DATABASE IF EXISTS ${testDatabaseName} WITH (FORCE)`,
    );
  });

  // Auth resolves the acting user from the JWT `sub`, so a token must carry
  // the id of the DB user it represents.
  const accessTokenForUserId = (userId: number): string =>
    jwtService.sign(
      siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
    );

  // A signer for someone who isn't a member: a large `sub` that can't
  // collide with another user's single-digit `sub`.
  const nonMemberToken = (): string =>
    accessTokenForUserId(
      faker.number.int({ min: 69420, max: DB_MAX_SAFE_INTEGER }),
    );

  // Registers a fresh user and creates a space they administer.
  async function createSpaceForSigner(): Promise<{
    accessToken: string;
    spaceId: string;
  }> {
    const walletResponse = await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [
        `access_token=${jwtService.sign(siweAuthPayloadDtoBuilder().build())}`,
      ])
      .expect(201);
    const accessToken = accessTokenForUserId(walletResponse.body.id);
    const createSpaceResponse = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: nameBuilder() })
      .expect(201);
    return { accessToken, spaceId: createSpaceResponse.body.uuid };
  }

  async function addSafe(
    spaceId: string,
    accessToken: string,
  ): Promise<{ chainId: string; address: `0x${string}` }> {
    const safe = {
      chainId: '1',
      address: getAddress(faker.finance.ethereumAddress()),
    };
    await request(app.getHttpServer())
      .post(`/v1/spaces/${spaceId}/safes`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ safes: [safe] })
      .expect(201);
    return safe;
  }

  it('should require authentication for every endpoint', () => {
    const endpoints = [EntitlementsController.prototype.getEntitlements];
    for (const fn of endpoints) {
      checkGuardIsApplied(AuthGuard, fn);
    }
  });

  describe('GET /v1/spaces/:spaceId/entitlements', () => {
    it('returns 400 for a malformed spaceId', async () => {
      const { accessToken } = await createSpaceForSigner();

      await request(app.getHttpServer())
        .get('/v1/spaces/not-a-uuid/entitlements')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400);
    });

    it('returns 403 for a non-member', async () => {
      const { spaceId } = await createSpaceForSigner();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/entitlements`)
        .set('Cookie', [`access_token=${nonMemberToken()}`])
        .expect(403);
    });

    it('returns the Free-tier entitlements for a member', async () => {
      const { accessToken, spaceId } = await createSpaceForSigner();

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/entitlements`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.plan).toBeNull();
          expect(body.entitlements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                feature: 'safe_seats',
                type: FeatureType.Metered,
                enabled: true,
                quota: FREE_SAFE_SEATS,
                used: 0,
              }),
              expect.objectContaining({
                feature: 'security_hub',
                type: FeatureType.Binary,
                enabled: false,
              }),
            ]),
          );
        });
    });

    it('counts the workspace Safes as seat usage', async () => {
      const { accessToken, spaceId } = await createSpaceForSigner();
      await addSafe(spaceId, accessToken);
      await addSafe(spaceId, accessToken);
      await addSafe(spaceId, accessToken);

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/entitlements`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect(({ body }) => {
          expect(body.entitlements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                feature: 'safe_seats',
                quota: FREE_SAFE_SEATS,
                used: 3,
              }),
            ]),
          );
        });
    });
  });
});
