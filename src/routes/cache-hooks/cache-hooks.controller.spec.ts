import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { Server } from 'net';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { safeCreatedEventBuilder } from '@/routes/cache-hooks/entities/__tests__/safe-created.build';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';

describe('Post Hook Events (Unit)', () => {
  let app: INestApplication<Server>;
  let authToken: string;
  let safeConfigUrl: string;
  let fakeCacheService: FakeCacheService;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: IConfigurationService;
  let blockchainApiManager: IBlockchainApiManager;
  let transactionApiManager: ITransactionApiManager;
  let balancesApiManager: IBalancesApiManager;

  async function initApp(config: typeof configuration): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();
    app = moduleFixture.createNestApplication();

    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    configurationService = moduleFixture.get(IConfigurationService);
    blockchainApiManager = moduleFixture.get<IBlockchainApiManager>(
      IBlockchainApiManager,
    );
    transactionApiManager = moduleFixture.get(ITransactionApiManager);
    balancesApiManager = moduleFixture.get(IBalancesApiManager);
    authToken = configurationService.getOrThrow('auth.token');
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    await initApp(configuration);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 410 if the eventsQueue FF is active and the hook is not CHAIN_UPDATE or SAFE_APPS_UPDATE', async () => {
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        eventsQueue: true,
      },
    });

    await initApp(testConfiguration);

    const payload = {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    };
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(410);
  });

  it('should throw an error if authorization is not sent in the request headers', async () => {
    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .send({})
      .expect(403);
  });

  it.each([
    {
      type: 'DELETED_MULTISIG_TRANSACTION',
      address: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      address: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_ETHER',
      address: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'INCOMING_TOKEN',
      address: faker.finance.ethereumAddress(),
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_ETHER',
      address: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'OUTGOING_TOKEN',
      address: faker.finance.ethereumAddress(),
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'NEW_CONFIRMATION',
      address: faker.finance.ethereumAddress(),
      owner: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      address: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MODULE_TRANSACTION',
      address: faker.finance.ethereumAddress(),
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MESSAGE_CREATED',
      address: faker.finance.ethereumAddress(),
      messageHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MESSAGE_CONFIRMATION',
      address: faker.finance.ethereumAddress(),
      messageHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'CHAIN_UPDATE',
    },
    {
      type: 'SAFE_APPS_UPDATE',
    },
    {
      type: 'SAFE_CREATED',
      address: faker.finance.ethereumAddress(),
      blockNumber: faker.number.int(),
    },
  ])('accepts $type', async (payload) => {
    const chainId = faker.string.numeric();
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);
  });

  it('returns 400 (Bad Request) on unknown payload', async () => {
    const data = {
      type: 'SOME_TEST_TYPE_THAT_WE_DO_NOT_SUPPORT',
      safeTxHash: 'some-safe-tx-hash',
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/1`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', '1').build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_union_discriminator',
        options: [
          'CHAIN_UPDATE',
          'DELETED_MULTISIG_TRANSACTION',
          'EXECUTED_MULTISIG_TRANSACTION',
          'INCOMING_ETHER',
          'INCOMING_TOKEN',
          'MESSAGE_CREATED',
          'MODULE_TRANSACTION',
          'NEW_CONFIRMATION',
          'MESSAGE_CONFIRMATION',
          'OUTGOING_ETHER',
          'OUTGOING_TOKEN',
          'PENDING_MULTISIG_TRANSACTION',
          'SAFE_APPS_UPDATE',
          'SAFE_CREATED',
        ],
        path: ['type'],
        message:
          "Invalid discriminator value. Expected 'CHAIN_UPDATE' | 'DELETED_MULTISIG_TRANSACTION' | 'EXECUTED_MULTISIG_TRANSACTION' | 'INCOMING_ETHER' | 'INCOMING_TOKEN' | 'MESSAGE_CREATED' | 'MODULE_TRANSACTION' | 'NEW_CONFIRMATION' | 'MESSAGE_CONFIRMATION' | 'OUTGOING_ETHER' | 'OUTGOING_TOKEN' | 'PENDING_MULTISIG_TRANSACTION' | 'SAFE_APPS_UPDATE' | 'SAFE_CREATED'",
      });
  });

  it.each([
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'INCOMING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears balances', async (payload) => {
    const chainId = faker.string.numeric({
      exclude: configurationService.getOrThrow(
        'features.zerionBalancesChainIds',
      ),
    });
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const safeAddress = getAddress(safe.address);
    const cacheDir = new CacheDir(
      `${chainId}_safe_balances_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chain,
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'NEW_CONFIRMATION',
      owner: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'DELETED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears multisig transactions', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_multisig_transactions_${getAddress(safeAddress)}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'NEW_CONFIRMATION',
      owner: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'DELETED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears multisig transaction', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_multisig_transaction_${payload.safeTxHash}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MODULE_TRANSACTION',
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears safe info', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_safe_${getAddress(safeAddress)}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears safe collectibles', async (payload) => {
    const chainId = faker.string.numeric({
      exclude: configurationService.getOrThrow(
        'features.zerionBalancesChainIds',
      ),
    });
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const safeAddress = getAddress(safe.address);
    const cacheDir = new CacheDir(
      `${chainId}_safe_collectibles_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chain,
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
          return Promise.resolve({ data: safe, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears safe collectible transfers', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_transfers_${getAddress(safeAddress)}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
  ])('$type clears incoming transfers', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_incoming_transfers_${getAddress(safeAddress)}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'MODULE_TRANSACTION',
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears module transactions', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_module_transactions_${getAddress(safeAddress)}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'MODULE_TRANSACTION',
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'INCOMING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'OUTGOING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'INCOMING_ETHER',
      txHash: faker.string.hexadecimal({ length: 32 }),
      value: faker.string.numeric(),
    },
    {
      type: 'OUTGOING_TOKEN',
      tokenAddress: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears all transactions', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_all_transactions_${getAddress(safeAddress)}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'MESSAGE_CREATED',
      messageHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MESSAGE_CONFIRMATION',
      messageHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears messages', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(
      `${chainId}_messages_${getAddress(safeAddress)}`,
      faker.string.alpha(),
    );
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      address: safeAddress,
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears chain', async (payload) => {
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(`${chainId}_chain`, '');
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chainId,
      ...payload,
    };

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears chains', async (payload) => {
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(`chains`, '');
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chainId,
      ...payload,
    };

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears the blockchain API', async (payload) => {
    const chainId = faker.string.numeric();
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await blockchainApiManager.getApi(chainId);

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    const newApi = await blockchainApiManager.getApi(chainId);
    expect(api).not.toBe(newApi);
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears the transaction API', async (payload) => {
    const chainId = faker.string.numeric();
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await transactionApiManager.getApi(chainId);

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    const newApi = await transactionApiManager.getApi(chainId);
    expect(api).not.toBe(newApi);
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears the balances API', async (payload) => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await balancesApiManager.getApi(chainId, safeAddress);

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    const newApi = await balancesApiManager.getApi(chainId, safeAddress);
    expect(api).not.toBe(newApi);
  });

  it.each([
    {
      type: 'SAFE_APPS_UPDATE',
    },
  ])('$type clears safe apps', async (payload) => {
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(`${chainId}_safe_apps`, '');
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chainId,
      ...payload,
    };

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])(
    '$type clears chains even if the eventsQueue FF is active ',
    async (payload) => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          eventsQueue: true,
        },
      });
      await initApp(testConfiguration);
      const chainId = faker.string.numeric();
      const cacheDir = new CacheDir(`chains`, '');
      await fakeCacheService.set(
        cacheDir,
        faker.string.alpha(),
        faker.number.int({ min: 1 }),
      );
      const data = {
        chainId: chainId,
        ...payload,
      };

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(data)
        .expect(202);

      await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
    },
  );

  it.each([
    {
      type: 'SAFE_APPS_UPDATE',
    },
  ])(
    '$type clears safe apps even if the eventsQueue FF is active',
    async (payload) => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          eventsQueue: true,
        },
      });
      await initApp(testConfiguration);
      const chainId = faker.string.numeric();
      const cacheDir = new CacheDir(`${chainId}_safe_apps`, '');
      await fakeCacheService.set(
        cacheDir,
        faker.string.alpha(),
        faker.number.int({ min: 1 }),
      );
      const data = {
        chainId: chainId,
        ...payload,
      };

      await request(app.getHttpServer())
        .post(`/hooks/events`)
        .set('Authorization', `Basic ${authToken}`)
        .send(data)
        .expect(202);

      await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
    },
  );

  it.each([
    {
      type: 'SAFE_CREATED',
    },
  ])('$type clears Safe existence', async () => {
    const data = safeCreatedEventBuilder().build();
    const cacheDir = new CacheDir(
      `${data.chainId}_safe_exists_${data.address}`,
      '',
    );
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${data.chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', data.chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    await fakeCacheService.set(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.get(cacheDir)).resolves.toBeUndefined();
  });
});
