// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import type { MockedObject } from 'vitest';
import { TestDbFactory } from '#/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import {
  addSafes as addSafesFixture,
  createSpaceForSigner as createSpaceForSignerFixture,
} from '#/__tests__/util/space-fixtures';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { IJwtService } from '#/datasources/jwt/jwt.service.interface';
import { NetworkResponseError } from '#/datasources/network/entities/network.error.entity';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { NotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/test.notification.repository.module';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { SpacesCreationRateLimitGuard } from '#/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { rawify } from '#/validation/entities/raw.entity';

describe('SpaceTransactionsController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let postgresDatabaseService: PostgresDatabaseService;
  let networkService: MockedObject<INetworkService>;
  let safeConfigUrl: string;
  let queueBaseUri: string;

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
        safeQueueService: true,
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
    networkService = moduleFixture.get(NetworkService);
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    queueBaseUri = configurationService.getOrThrow('safeQueueService.baseUri');

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    networkService.get.mockImplementation(({ url }) =>
      Promise.reject(new Error(`No matching rule for url: ${url}`)),
    );
  });

  /**
   * The app caches chains by id across tests, and the builder's one-digit id
   * repeats within a file: a repeat would serve an earlier test's chain, with
   * another Transaction Service URL than this test mocks.
   */
  function uniqueChain(): Chain {
    return chainBuilder()
      .with(
        'chainId',
        faker.string.numeric({ length: 12, allowLeadingZeros: false }),
      )
      .build();
  }

  function mockUpstreams(args: { chain: Chain; deployed: Array<Safe> }): void {
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${args.chain.chainId}`) {
        return Promise.resolve({ data: rawify(args.chain), status: 200 });
      }
      const deployedSafe = args.deployed.find(
        (safe) =>
          url ===
          `${args.chain.transactionService}/api/v1/safes/${safe.address}`,
      );
      if (deployedSafe) {
        return Promise.resolve({ data: rawify(deployedSafe), status: 200 });
      }
      if (url.startsWith(`${args.chain.transactionService}/api/v1/safes/`)) {
        return Promise.reject(
          new NetworkResponseError(
            new URL(url),
            { status: HttpStatus.NOT_FOUND } as Response,
            { message: 'Not found' },
          ),
        );
      }
      if (
        url.startsWith(`${queueBaseUri}/api/v1/multisig-transactions/queue`)
      ) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('count', 0)
              .with('next', null)
              .with('previous', null)
              .with('results', [])
              .build(),
          ),
          status: 200,
        });
      }
      return Promise.reject(new Error(`No matching rule for url: ${url}`));
    });
  }

  describe('GET /v1/spaces/:spaceId/transactions/queued', () => {
    it('rejects an unauthenticated request', async () => {
      const { spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('rejects a caller who is not a member of the Space', async () => {
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

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .set('Cookie', [`access_token=${strangerAccessToken}`])
        .expect(HttpStatus.FORBIDDEN);
    });

    it('returns an empty page for a Space without Safes', async () => {
      const { accessToken, spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.OK)
        .expect({
          count: 0,
          next: null,
          previous: null,
          results: [],
          unavailableSafes: [],
        });
    });

    it('queries the queue for the deployed Safes of the Space and reports the others as unavailable', async () => {
      const { accessToken, spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });
      const chain = uniqueChain();
      const deployed = safeBuilder().build();
      const undeployed = safeBuilder().build();
      await addSafesFixture({
        app,
        spaceUuid,
        accessToken,
        safes: [
          { chainId: chain.chainId, address: deployed.address },
          { chainId: chain.chainId, address: undeployed.address },
        ],
      }).then((response) => expect(response.status).toBe(HttpStatus.CREATED));
      mockUpstreams({ chain, deployed: [deployed] });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.OK)
        .expect({
          count: 0,
          next: null,
          previous: null,
          results: [],
          unavailableSafes: [
            { chainId: chain.chainId, safeAddress: undeployed.address },
          ],
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/multisig-transactions/queue`,
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              safes: [`${deployed.address}:${chain.chainId}`],
            }),
          }),
        }),
      );
    });

    it('serves a repeated request from the cache of the Space', async () => {
      const { accessToken, spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });
      const chain = uniqueChain();
      const deployed = safeBuilder().build();
      await addSafesFixture({
        app,
        spaceUuid,
        accessToken,
        safes: [{ chainId: chain.chainId, address: deployed.address }],
      }).then((response) => expect(response.status).toBe(HttpStatus.CREATED));
      mockUpstreams({ chain, deployed: [deployed] });

      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
          .set('Cookie', [`access_token=${accessToken}`])
          .expect(HttpStatus.OK);
      }

      expect(queueRequests()).toHaveLength(1);
    });

    it('queries the queue again once a Safe is added to the Space', async () => {
      const { accessToken, spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });
      const chain = uniqueChain();
      const [first, second] = [safeBuilder().build(), safeBuilder().build()];
      await addSafesFixture({
        app,
        spaceUuid,
        accessToken,
        safes: [{ chainId: chain.chainId, address: first.address }],
      }).then((response) => expect(response.status).toBe(HttpStatus.CREATED));
      mockUpstreams({ chain, deployed: [first, second] });
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.OK);

      await addSafesFixture({
        app,
        spaceUuid,
        accessToken,
        safes: [{ chainId: chain.chainId, address: second.address }],
      }).then((response) => expect(response.status).toBe(HttpStatus.CREATED));
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.OK);

      expect(queueRequests()).toHaveLength(2);
    });
  });

  function queueRequests(): Array<unknown> {
    return networkService.get.mock.calls.filter(([{ url }]) =>
      url.startsWith(`${queueBaseUri}/api/v1/multisig-transactions/queue`),
    );
  }
});

describe('SpaceTransactionsController with features.safeQueueService off', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let postgresDatabaseService: PostgresDatabaseService;

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
        safeQueueService: false,
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

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  it('does not serve the queue of a Space', async () => {
    const { spaceUuid, accessToken } = await createSpaceForSignerFixture({
      app,
      jwtService,
      postgresDatabaseService,
    });

    await request(app.getHttpServer())
      .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
      .set('Cookie', [`access_token=${accessToken}`])
      .expect(HttpStatus.NOT_FOUND);
  });
});
