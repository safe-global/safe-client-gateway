// SPDX-License-Identifier: FSL-1.1-MIT
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type postgres from 'postgres';
import request from 'supertest';
import { getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import { TestDbFactory } from '@/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestBlocklistModule } from '@/config/entities/__tests__/test.blocklist.module';
import { BlocklistModule } from '@/config/entities/blocklist.module';
import { CosignerAppModule } from '@/cosigner-app.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestTxAuthNetworkModule } from '@/datasources/network/__tests__/test.tx-auth.network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { cloudCosignerPolicyBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-policy.builder';
import { buildPolicyMessage } from '@/modules/cloud-cosigner/domain/utils/policy-message';
import { TestQueuesApiModule } from '@/modules/queues/datasources/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/modules/queues/datasources/queues-api.module';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { rawify } from '@/validation/entities/raw.entity';

/**
 * Boots the cosigner deployable's own root module — not the gateway's
 * `AppModule` — against a migrated database, so a provider the module forgot
 * to import fails here rather than at deploy time.
 */
describe('CloudCosignerController (cosigner deployable)', () => {
  let app: INestApplication<Server>;
  let networkService: MockedObject<INetworkService>;
  let safeConfigUrl: string;
  let cosignerAddress: `0x${string}`;
  let defaultValueThreshold: number;

  const testDatabaseName = `test_${randomUUID().replaceAll('-', '')}`;
  const testDbFactory = new TestDbFactory();
  let testDatabase: postgres.Sql;

  const owner = privateKeyToAccount(generatePrivateKey());
  const chain = chainBuilder().with('chainId', '1').build();

  function mockSafe(owners: Array<`0x${string}`>): `0x${string}` {
    const safe = safeBuilder().with('owners', owners).build();
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        default:
          return Promise.reject(new Error(`Unexpected request: ${url}`));
      }
    });
    return safe.address;
  }

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
    });
    cosignerAddress = privateKeyToAccount(
      defaultConfiguration.cloudCosigner.signer.privateKey as `0x${string}`,
    ).address;
    defaultValueThreshold =
      defaultConfiguration.cloudCosigner.defaultPolicy.valueThresholdUsd;

    const moduleFixture = await Test.createTestingModule({
      imports: [CosignerAppModule.register(testConfiguration)],
    })
      .overrideProvider(CacheKeyPrefix)
      .useValue(randomUUID())
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(BlocklistModule)
      .useModule(TestBlocklistModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(TxAuthNetworkModule)
      .useModule(TestTxAuthNetworkModule)
      .compile();

    safeConfigUrl = moduleFixture
      .get<IConfigurationService>(IConfigurationService)
      .getOrThrow('safeConfig.baseUri');
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
  });

  it('GET /v1/cloud-cosigner returns the cosigner address and default policy', async () => {
    await request(app.getHttpServer())
      .get('/v1/cloud-cosigner')
      .expect(200)
      .expect({
        address: cosignerAddress,
        defaultPolicy: {
          valueThresholdUsd: defaultValueThreshold,
          reviewUnknownContracts: true,
          instructions: null,
        },
      });
  });

  it('GET .../cloud-cosigner reports enablement from the Safe owners', async () => {
    const enabledSafe = mockSafe([owner.address, cosignerAddress]);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${enabledSafe}/cloud-cosigner`)
      .expect(200)
      .expect({
        cosignerAddress,
        isEnabled: true,
        policy: {
          valueThresholdUsd: defaultValueThreshold,
          reviewUnknownContracts: true,
          instructions: null,
        },
        isDefaultPolicy: true,
      });
  });

  it('GET .../cloud-cosigner rejects a malformed Safe address', async () => {
    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/not-an-address/cloud-cosigner`)
      .expect(422);
  });

  describe('PUT .../cloud-cosigner/policy', () => {
    async function signedBody(args: {
      safeAddress: `0x${string}`;
      policy: ReturnType<
        typeof cloudCosignerPolicyBuilder
      >['build'] extends () => infer P
        ? P
        : never;
      issuedAt?: Date;
      signer?: typeof owner;
    }): Promise<Record<string, unknown>> {
      const issuedAt = (args.issuedAt ?? new Date()).toISOString();
      const signer = args.signer ?? owner;
      const signature = await signer.signMessage({
        message: buildPolicyMessage({
          chainId: chain.chainId,
          safeAddress: args.safeAddress,
          issuedAt,
          policy: args.policy,
        }),
      });
      return {
        policy: args.policy,
        signer: signer.address,
        signature,
        issuedAt,
      };
    }

    it('stores a policy signed by an owner and serves it back', async () => {
      const safeAddress = mockSafe([owner.address, cosignerAddress]);
      const policy = cloudCosignerPolicyBuilder()
        .with('valueThresholdUsd', 25_000)
        .with('reviewUnknownContracts', false)
        .with('instructions', 'Vendors only.')
        .build();

      await request(app.getHttpServer())
        .put(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/cloud-cosigner/policy`,
        )
        .send(await signedBody({ safeAddress, policy }))
        .expect(200)
        .expect(policy);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safeAddress}/cloud-cosigner`)
        .expect(200)
        .expect({
          cosignerAddress,
          isEnabled: true,
          policy,
          isDefaultPolicy: false,
        });
    });

    it('rejects a signature from a non-owner with 403', async () => {
      const safeAddress = mockSafe([
        getAddress(faker.finance.ethereumAddress()),
        cosignerAddress,
      ]);

      await request(app.getHttpServer())
        .put(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/cloud-cosigner/policy`,
        )
        .send(
          await signedBody({
            safeAddress,
            policy: cloudCosignerPolicyBuilder().build(),
          }),
        )
        .expect(403);
    });

    it('rejects a tampered policy with 401', async () => {
      const safeAddress = mockSafe([owner.address, cosignerAddress]);
      const body = await signedBody({
        safeAddress,
        policy: cloudCosignerPolicyBuilder()
          .with('valueThresholdUsd', 1)
          .build(),
      });

      await request(app.getHttpServer())
        .put(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/cloud-cosigner/policy`,
        )
        .send({
          ...body,
          policy: { ...(body.policy as object), valueThresholdUsd: 1_000_000 },
        })
        .expect(401);
    });

    it('rejects a stale signature with 401', async () => {
      const safeAddress = mockSafe([owner.address, cosignerAddress]);

      await request(app.getHttpServer())
        .put(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/cloud-cosigner/policy`,
        )
        .send(
          await signedBody({
            safeAddress,
            policy: cloudCosignerPolicyBuilder().build(),
            issuedAt: new Date(Date.now() - 24 * 60 * 60 * 1_000),
          }),
        )
        .expect(401);
    });

    it('rejects a body that fails validation with 422', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .put(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/cloud-cosigner/policy`,
        )
        .send({ policy: { valueThresholdUsd: -1 } })
        .expect(422);
    });
  });

  it('GET .../reviews/:safeTxHash returns 404 when nothing was reviewed', async () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safeTxHash = faker.string.hexadecimal({ length: 64 });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safeAddress}/cloud-cosigner/reviews/${safeTxHash}`,
      )
      .expect(404);
  });
});
