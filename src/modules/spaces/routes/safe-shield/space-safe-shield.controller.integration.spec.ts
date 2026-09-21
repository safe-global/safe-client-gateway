// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { TestDbFactory } from '@/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import {
  addSafes as addSafesFixture,
  createSpaceForSigner as createSpaceForSignerFixture,
  grantEntitlements,
} from '@/__tests__/util/space-fixtures';
import configuration from '@/config/entities/__tests__/configuration';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { QUOTA_EXCEEDED_ERROR_CODE } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { EntitlementsService } from '@/modules/entitlements/routes/entitlements.service';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { counterpartyAnalysisRequestDtoBuilder } from '@/modules/safe-shield/entities/__tests__/builders/analysis-requests.builder';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

describe('SpaceSafeShieldController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let postgresDatabaseService: PostgresDatabaseService;
  let entitlementsService: EntitlementsService;
  let networkService: MockedObject<INetworkService>;

  const testDatabaseName = `test_${randomUUID().replaceAll('-', '')}`;
  const testDbFactory = new TestDbFactory();
  let testDatabase: postgres.Sql;

  beforeAll(async () => {
    testDatabase = await testDbFactory.createTestDatabase(testDatabaseName);

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
        billingService: false,
      },
      entitlements: {
        ...defaultConfiguration.entitlements,
        // Enforcing: the point of this suite is what the plan decides.
        enforcementStartsAt: faker.date.past(),
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      cacheKeyPrefix: testDatabaseName,
      guards: [
        {
          originalGuard: SpacesCreationRateLimitGuard,
          testGuard: { canActivate: (): true => true },
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
    entitlementsService = moduleFixture.get(EntitlementsService);
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    // Recipient/counterparty analysis degrades to a graceful-but-200 result
    // when upstream is unreachable — see safe-shield.controller.integration.spec.ts.
    // This suite is about the gating chain, not the analysis itself.
    networkService.get.mockImplementation(({ url }) =>
      Promise.reject(new Error(`No matching rule for url: ${url}`)),
    );
  });

  describe('GET .../security/:safeAddress/recipient/:recipientAddress', () => {
    it('rejects an unauthenticated request', async () => {
      const { spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });
      const safe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };

      // No Safe/entitlement setup needed: AuthGuard must reject before
      // anything else runs.
      await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceUuid}/chains/${safe.chainId}/security/${safe.address}/recipient/${getAddress(faker.finance.ethereumAddress())}`,
        )
        .expect(HttpStatus.FORBIDDEN);
    });

    it('rejects a non-member of the Space before revealing its plan/quota state', async () => {
      const { spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });
      const { accessToken: strangerAccessToken } =
        await createSpaceForSignerFixture({
          app,
          jwtService,
          postgresDatabaseService,
        });
      // No entitlement granted: a member-check bug that let this through
      // would surface as a 402, not a 200, and still prove the leak.
      const safe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };

      await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceUuid}/chains/${safe.chainId}/security/${safe.address}/recipient/${getAddress(faker.finance.ethereumAddress())}`,
        )
        .set('Cookie', [`access_token=${strangerAccessToken}`])
        .expect(HttpStatus.FORBIDDEN);
    });

    it('rejects with 402 when the Space has no copilot_scans entitlement', async () => {
      const { accessToken, spaceUuid, spaceId } =
        await createSpaceForSignerFixture({
          app,
          jwtService,
          postgresDatabaseService,
        });
      const safe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };
      // Seats, not copilot_scans: only setting up "the Safe is registered".
      await grantEntitlements({
        entitlementsService,
        spaceId,
        entitlements: [{ featureKey: 'safe_seats', quota: 1 }],
      });
      await addSafesFixture({
        app,
        spaceUuid,
        accessToken,
        safes: [safe],
      }).then((response) => expect(response.status).toBe(201));

      const response = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceUuid}/chains/${safe.chainId}/security/${safe.address}/recipient/${getAddress(faker.finance.ethereumAddress())}`,
        )
        .set('Cookie', [`access_token=${accessToken}`]);

      expect(response.status).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(response.body).toMatchObject({
        code: QUOTA_EXCEEDED_ERROR_CODE,
        feature: 'copilot_scans',
      });
    });

    it('rejects with 403 when the Safe is not registered to the Space', async () => {
      const { accessToken, spaceUuid, spaceId } =
        await createSpaceForSignerFixture({
          app,
          jwtService,
          postgresDatabaseService,
        });
      await grantEntitlements({
        entitlementsService,
        spaceId,
        entitlements: [{ featureKey: 'copilot_scans', quota: null }],
      });
      const unregisteredSafe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };

      await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceUuid}/chains/${unregisteredSafe.chainId}/security/${unregisteredSafe.address}/recipient/${getAddress(faker.finance.ethereumAddress())}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.FORBIDDEN);
    });

    it('returns 200 for a member of a Space with a registered Safe and copilot_scans entitlement', async () => {
      const { accessToken, spaceUuid, spaceId } =
        await createSpaceForSignerFixture({
          app,
          jwtService,
          postgresDatabaseService,
        });
      await grantEntitlements({
        entitlementsService,
        spaceId,
        entitlements: [
          { featureKey: 'copilot_scans', quota: null },
          { featureKey: 'safe_seats', quota: 1 },
        ],
      });
      const safe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };
      await addSafesFixture({
        app,
        spaceUuid,
        accessToken,
        safes: [safe],
      }).then((response) => expect(response.status).toBe(201));

      const response = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceUuid}/chains/${safe.chainId}/security/${safe.address}/recipient/${getAddress(faker.finance.ethereumAddress())}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(response.body).toHaveProperty('isSafe', false);
      expect(response.body.RECIPIENT_INTERACTION[0]).toHaveProperty(
        'type',
        'FAILED',
      );
      expect(response.body.RECIPIENT_ACTIVITY[0]).toHaveProperty(
        'type',
        'FAILED',
      );
    });
  });

  describe('POST .../security/:safeAddress/counterparty-analysis', () => {
    it('rejects an unauthenticated request', async () => {
      const { spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });
      const safe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };

      // No Safe/entitlement setup needed: AuthGuard must reject before
      // anything else runs.
      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceUuid}/chains/${safe.chainId}/security/${safe.address}/counterparty-analysis`,
        )
        .send(counterpartyAnalysisRequestDtoBuilder().build())
        .expect(HttpStatus.FORBIDDEN);
    });

    it('rejects a non-member of the Space before revealing its plan/quota state', async () => {
      const { spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });
      const { accessToken: strangerAccessToken } =
        await createSpaceForSignerFixture({
          app,
          jwtService,
          postgresDatabaseService,
        });
      // No entitlement granted: a member-check bug that let this through
      // would surface as a 402, not a 200, and still prove the leak.
      const safe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceUuid}/chains/${safe.chainId}/security/${safe.address}/counterparty-analysis`,
        )
        .set('Cookie', [`access_token=${strangerAccessToken}`])
        .send(counterpartyAnalysisRequestDtoBuilder().build())
        .expect(HttpStatus.FORBIDDEN);
    });

    it('rejects with 402 when the Space has no copilot_scans entitlement', async () => {
      const { accessToken, spaceUuid, spaceId } =
        await createSpaceForSignerFixture({
          app,
          jwtService,
          postgresDatabaseService,
        });
      const safe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };
      // Seats, not copilot_scans: only setting up "the Safe is registered".
      await grantEntitlements({
        entitlementsService,
        spaceId,
        entitlements: [{ featureKey: 'safe_seats', quota: 1 }],
      });
      await addSafesFixture({
        app,
        spaceUuid,
        accessToken,
        safes: [safe],
      }).then((response) => expect(response.status).toBe(201));

      const response = await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceUuid}/chains/${safe.chainId}/security/${safe.address}/counterparty-analysis`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(counterpartyAnalysisRequestDtoBuilder().build());

      expect(response.status).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(response.body).toMatchObject({
        code: QUOTA_EXCEEDED_ERROR_CODE,
        feature: 'copilot_scans',
      });
    });

    it('rejects with 403 when the Safe is not registered to the Space', async () => {
      const { accessToken, spaceUuid, spaceId } =
        await createSpaceForSignerFixture({
          app,
          jwtService,
          postgresDatabaseService,
        });
      await grantEntitlements({
        entitlementsService,
        spaceId,
        entitlements: [{ featureKey: 'copilot_scans', quota: null }],
      });
      const unregisteredSafe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceUuid}/chains/${unregisteredSafe.chainId}/security/${unregisteredSafe.address}/counterparty-analysis`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(counterpartyAnalysisRequestDtoBuilder().build())
        .expect(HttpStatus.FORBIDDEN);
    });

    it('returns 200 for a member of a Space with a registered Safe and copilot_scans entitlement', async () => {
      const { accessToken, spaceUuid, spaceId } =
        await createSpaceForSignerFixture({
          app,
          jwtService,
          postgresDatabaseService,
        });
      await grantEntitlements({
        entitlementsService,
        spaceId,
        entitlements: [
          { featureKey: 'copilot_scans', quota: null },
          { featureKey: 'safe_seats', quota: 1 },
        ],
      });
      const safe = {
        chainId: '1',
        address: getAddress(faker.finance.ethereumAddress()),
      };
      await addSafesFixture({
        app,
        spaceUuid,
        accessToken,
        safes: [safe],
      }).then((response) => expect(response.status).toBe(201));

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceUuid}/chains/${safe.chainId}/security/${safe.address}/counterparty-analysis`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(counterpartyAnalysisRequestDtoBuilder().build())
        .expect(200)
        .expect({ recipient: {}, contract: {}, deadlock: {} });
    });
  });
});
