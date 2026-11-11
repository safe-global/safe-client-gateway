// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import { type Address, getAddress } from 'viem';
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
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { safeQueueMultisigTransactionBuilder } from '#/modules/safe-queue/entities/__tests__/queue-multisig-transaction.builder';
import type { SafeQueueMultisigTransactionEntity } from '#/modules/safe-queue/entities/multisig-transaction.entity';
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

  function mockUpstreams(args: {
    chain: Chain;
    deployed: Array<Safe>;
    /** Other chains, each with its own deployed Safes */
    otherChains?: Array<{ chain: Chain; deployed: Array<Safe> }>;
    queue?: Array<SafeQueueMultisigTransactionEntity>;
  }): void {
    const chains = [
      { chain: args.chain, deployed: args.deployed },
      ...(args.otherChains ?? []),
    ];
    const queue = args.queue ?? [];
    networkService.get.mockImplementation(({ url }) => {
      for (const { chain, deployed } of chains) {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        const deployedSafe = deployed.find(
          (safe) =>
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`,
        );
        if (deployedSafe) {
          return Promise.resolve({ data: rawify(deployedSafe), status: 200 });
        }
        if (url.startsWith(`${chain.transactionService}/api/v1/safes/`)) {
          return Promise.reject(
            new NetworkResponseError(
              new URL(url),
              { status: HttpStatus.NOT_FOUND } as Response,
              { message: 'Not found' },
            ),
          );
        }
      }
      if (
        url.startsWith(`${queueBaseUri}/api/v1/multisig-transactions/queue`)
      ) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('count', queue.length)
              .with('next', null)
              .with('previous', null)
              .with('results', queue)
              .build(),
          ),
          status: 200,
        });
      }
      return Promise.reject(new Error(`No matching rule for url: ${url}`));
    });
  }

  /** A deployed Safe of a single owner, with one transaction it has yet to sign. */
  async function safeAwaitingSignature(chain: Chain): Promise<{
    safe: Safe;
    owner: Address;
    transaction: SafeQueueMultisigTransactionEntity;
  }> {
    const owner = getAddress(faker.finance.ethereumAddress());
    const safe = safeBuilder()
      .with('owners', [owner])
      .with('threshold', 1)
      .build();
    // Signed by no one; built through the builder for a valid safeTxHash
    const pending = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('nonce', safe.nonce)
      .with('data', null)
      .with('gasToken', null)
      .with('operation', Operation.CALL)
      .buildWithConfirmations({ chainId: chain.chainId, safe, signers: [] });
    const transaction = safeQueueMultisigTransactionBuilder()
      .with('safeTxHash', pending.safeTxHash)
      .with('chainId', chain.chainId)
      .with('safe', safe.address)
      .with('nonce', pending.nonce)
      .with('to', pending.to)
      .with('value', pending.value)
      .with('data', pending.data)
      .with('operation', pending.operation)
      .with('safeTxGas', pending.safeTxGas?.toString() ?? null)
      .with('baseGas', pending.baseGas?.toString() ?? null)
      .with('gasPrice', pending.gasPrice)
      .with('gasToken', pending.gasToken)
      .with('refundReceiver', pending.refundReceiver)
      .with('txHash', null)
      .with('confirmations', [])
      .build();
    return { safe, owner, transaction };
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
          results: {},
          unavailableSafes: [],
          counts: {
            total: 0,
            execute: 0,
            sign: 0,
            blocked: 0,
            waiting: 0,
            conflicting: 0,
            stale: 0,
            safes: [],
            chains: [],
            signers: [],
          },
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
          results: {},
          unavailableSafes: [
            { chainId: chain.chainId, safeAddress: undeployed.address },
          ],
          counts: {
            total: 0,
            execute: 0,
            sign: 0,
            blocked: 0,
            waiting: 0,
            conflicting: 0,
            stale: 0,
            safes: [],
            chains: [],
            signers: [],
          },
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

    it('rejects an unknown status, an invalid Safe, chain ID or signer and a non-boolean flag', async () => {
      const { accessToken, spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });

      for (const query of [
        { status: faker.word.noun() },
        { safes: faker.finance.ethereumAddress() },
        { chainIds: faker.word.noun() },
        { signers: faker.word.noun() },
        { conflicting: faker.word.noun() },
        { stale: faker.word.noun() },
      ]) {
        await request(app.getHttpServer())
          .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
          .query(query)
          .set('Cookie', [`access_token=${accessToken}`])
          .expect(HttpStatus.UNPROCESSABLE_ENTITY);
      }
    });

    it('filters the cached queue without querying it again', async () => {
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

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.OK);
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .query({
          status: 'sign,execute',
          safes: `${chain.chainId}:${deployed.address}`,
          chainIds: chain.chainId,
          signers: faker.finance.ethereumAddress(),
          conflicting: 'true',
          stale: 'false',
        })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.OK);

      expect(queueRequests()).toHaveLength(1);
    });

    it('returns only the transactions of the selected chains and still awaiting the selected signers', async () => {
      const { accessToken, spaceUuid } = await createSpaceForSignerFixture({
        app,
        jwtService,
        postgresDatabaseService,
      });
      const [chain, otherChain] = [uniqueChain(), uniqueChain()];
      const first = await safeAwaitingSignature(chain);
      const second = await safeAwaitingSignature(otherChain);
      await addSafesFixture({
        app,
        spaceUuid,
        accessToken,
        safes: [
          { chainId: chain.chainId, address: first.safe.address },
          { chainId: otherChain.chainId, address: second.safe.address },
        ],
      }).then((response) => expect(response.status).toBe(HttpStatus.CREATED));
      mockUpstreams({
        chain,
        deployed: [first.safe],
        otherChains: [{ chain: otherChain, deployed: [second.safe] }],
        queue: [first.transaction, second.transaction],
      });

      const all = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.OK);
      const byChain = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .query({ chainIds: chain.chainId })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.OK);
      const bySigner = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceUuid}/transactions/queued`)
        .query({ signers: second.owner })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(HttpStatus.OK);

      expect(all.body.results).toEqual({
        [first.safe.address]: { [chain.chainId]: expect.any(Array) },
        [second.safe.address]: { [otherChain.chainId]: expect.any(Array) },
      });
      expect(byChain.body.results).toEqual({
        [first.safe.address]: all.body.results[first.safe.address],
      });
      expect(byChain.body.counts.chains).toEqual(
        expect.arrayContaining([
          { chainId: chain.chainId, count: 1 },
          { chainId: otherChain.chainId, count: 1 },
        ]),
      );
      expect(bySigner.body.results).toEqual({
        [second.safe.address]: all.body.results[second.safe.address],
      });
      expect(bySigner.body.counts.signers).toEqual(
        expect.arrayContaining([
          { address: first.owner, count: 1 },
          { address: second.owner, count: 1 },
        ]),
      );
      expect(queueRequests()).toHaveLength(1);
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
