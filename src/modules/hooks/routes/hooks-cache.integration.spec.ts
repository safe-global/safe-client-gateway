import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { safeCreatedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/safe-created.build';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import { KilnDecoder } from '@/modules/staking/domain/contracts/decoders/kiln-decoder.helper';
import { stakeBuilder } from '@/modules/staking/datasources/entities/__tests__/stake.entity.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { IQueuesApiService } from '@/modules/queues/datasources/queues-api.service.interface';
import type { ConsumeMessage } from 'amqplib';
import {
  deletedDelegateEventBuilder,
  newDelegateEventBuilder,
  updatedDelegateEventBuilder,
} from '@/modules/hooks/routes/entities/__tests__/delegate-events.builder';
import { createTestModule } from '@/__tests__/testing-module';

function getSubscriptionCallback(
  queuesApiService: jest.MockedObjectDeep<IQueuesApiService>,
): (msg: ConsumeMessage) => Promise<void> {
  // First call, second argument
  return queuesApiService.subscribe.mock.calls[0][1];
}

// TODO: Migrate to E2E tests as TransactionEventType events are already being received via queue.
describe('Hook Events for Cache', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let fakeCacheService: FakeCacheService;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: IConfigurationService;
  let stakingApiManager: IStakingApiManager;
  let blockchainApiManager: IBlockchainApiManager;
  let transactionApiManager: ITransactionApiManager;
  let balancesApiManager: IBalancesApiManager;
  let queuesApiService: jest.MockedObjectDeep<IQueuesApiService>;

  async function initApp(config: typeof configuration): Promise<void> {
    const moduleFixture = await createTestModule({
      config,
    });

    app = moduleFixture.createNestApplication();

    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    configurationService = moduleFixture.get(IConfigurationService);
    stakingApiManager =
      moduleFixture.get<IStakingApiManager>(IStakingApiManager);
    blockchainApiManager = moduleFixture.get<IBlockchainApiManager>(
      IBlockchainApiManager,
    );
    transactionApiManager = moduleFixture.get(ITransactionApiManager);
    balancesApiManager = moduleFixture.get(IBalancesApiManager);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);
    queuesApiService = moduleFixture.get(IQueuesApiService);

    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    await initApp(configuration);
  });

  afterAll(async () => {
    await app.close();
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
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const safeAddress = getAddress(safe.address);
    const cacheDir = new CacheDir(
      `${chainId}_safe_balances_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.hSet(
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
            data: rawify(chain),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      to: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      to: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
      failed: faker.helpers.arrayElement(['true', 'false']),
      data: faker.string.hexadecimal({ length: 32 }),
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
    await fakeCacheService.hSet(
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'PENDING_MULTISIG_TRANSACTION',
      to: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      to: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
      failed: faker.helpers.arrayElement(['true', 'false']),
      data: faker.string.hexadecimal({ length: 32 }),
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
    await fakeCacheService.hSet(
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      to: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
      failed: faker.helpers.arrayElement(['true', 'false']),
      data: faker.string.hexadecimal({ length: 32 }),
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
    await fakeCacheService.hSet(
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      to: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
      failed: faker.helpers.arrayElement(['true', 'false']),
      data: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'MODULE_TRANSACTION',
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears Safe stakes', async (payload) => {
    const safeAddress = faker.finance.ethereumAddress();
    const chainId = faker.string.numeric();
    const validatorsPublicKeys = faker.string.hexadecimal({
      length: KilnDecoder.KilnPublicKeyLength,
    });
    const stakes = faker.helpers.multiple(() => stakeBuilder().build(), {
      count: validatorsPublicKeys.length,
    });
    const cacheDir = new CacheDir(
      `${chainId}_staking_stakes_${getAddress(safeAddress)}`,
      validatorsPublicKeys,
    );
    await fakeCacheService.hSet(
      cacheDir,
      JSON.stringify(stakes),
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      to: faker.finance.ethereumAddress(),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
      failed: faker.helpers.arrayElement(['true', 'false']),
      data: faker.string.hexadecimal({ length: 32 }),
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
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const safeAddress = getAddress(safe.address);
    const cacheDir = new CacheDir(
      `${chainId}_safe_collectibles_${safeAddress}`,
      faker.string.alpha(),
    );
    await fakeCacheService.hSet(
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
            data: rawify(chain),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      to: faker.finance.ethereumAddress(),
      failed: faker.helpers.arrayElement(['true', 'false']),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
      data: faker.string.hexadecimal({ length: 32 }),
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
    await fakeCacheService.hSet(
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
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
    await fakeCacheService.hSet(
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
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
    await fakeCacheService.hSet(
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'MODULE_TRANSACTION',
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
    {
      type: 'EXECUTED_MULTISIG_TRANSACTION',
      to: faker.finance.ethereumAddress(),
      failed: faker.helpers.arrayElement(['true', 'false']),
      safeTxHash: faker.string.hexadecimal({ length: 32 }),
      txHash: faker.string.hexadecimal({ length: 32 }),
      data: faker.string.hexadecimal({ length: 32 }),
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
    await fakeCacheService.hSet(
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
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
    await fakeCacheService.hSet(
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears chain', async (payload) => {
    const chain = chainBuilder().build();
    const cacheDir = new CacheDir(`${chain.chainId}_chain`, '');
    await fakeCacheService.hSet(
      cacheDir,
      JSON.stringify(chain),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chain.chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears chains', async (payload) => {
    const chain = chainBuilder().build();
    const cacheDir = new CacheDir(`chains`, '');
    await fakeCacheService.hSet(
      cacheDir,
      JSON.stringify(chain),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chain.chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({
            data: rawify(chainBuilder().with('chainId', chain.chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears v2 chain cache', async (payload) => {
    const chain = chainBuilder().build();
    const serviceKey = 'WALLET_WEB';
    const cacheDir = new CacheDir(
      `${chain.chainId}_chain_v2_${serviceKey}`,
      '',
    );
    await fakeCacheService.hSet(
      cacheDir,
      JSON.stringify(chain),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chain.chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${safeConfigUrl}/api/v2/chains/${serviceKey}/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears v2 chains list cache', async (payload) => {
    const chain = chainBuilder().build();
    const serviceKey = 'WALLET_WEB';
    const cacheDir = new CacheDir(`chains_v2_${serviceKey}`, '');
    await fakeCacheService.hSet(
      cacheDir,
      JSON.stringify(chain),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chain.chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({
            data: rawify(chainBuilder().with('chainId', chain.chainId).build()),
            status: 200,
          });
        case `${safeConfigUrl}/api/v2/chains/${serviceKey}/${chain.chainId}`:
          return Promise.resolve({
            data: rawify(chainBuilder().with('chainId', chain.chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears the staking API', async (payload) => {
    const chainId = faker.string.numeric();
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await stakingApiManager.getApi(chainId);

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    const newApi = await stakingApiManager.getApi(chainId);
    expect(api).not.toBe(newApi);
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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await blockchainApiManager.getApi(chainId);

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await transactionApiManager.getApi(chainId);

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

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
            data: rawify(chainBuilder().with('chainId', chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await balancesApiManager.getApi(chainId, safeAddress);

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    const newApi = await balancesApiManager.getApi(chainId, safeAddress);
    expect(api).not.toBe(newApi);
  });

  it.each([
    {
      type: 'SAFE_APPS_UPDATE',
    },
  ])('$type clears safe apps', async (payload) => {
    const chain = chainBuilder().build();
    const cacheDir = new CacheDir(`${chain.chainId}_safe_apps`, '');
    await fakeCacheService.hSet(
      cacheDir,
      JSON.stringify(chain),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chain.chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({
            data: rawify(chain),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

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
            data: rawify(chainBuilder().with('chainId', data.chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    await fakeCacheService.hSet(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(data)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });

  it.each(
    [
      newDelegateEventBuilder().build(),
      updatedDelegateEventBuilder().build(),
      deletedDelegateEventBuilder().build(),
    ].map((event) => [event.type, event]),
  )('%s clears delegates', async (_, event) => {
    const cacheDir = new CacheDir(
      `${event.chainId}_delegates_${event.address}`,
      '',
    );
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${event.chainId}`:
          return Promise.resolve({
            data: rawify(chainBuilder().with('chainId', event.chainId).build()),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    await fakeCacheService.hSet(
      cacheDir,
      faker.string.alpha(),
      faker.number.int({ min: 1 }),
    );

    const cb = getSubscriptionCallback(queuesApiService);
    await cb({ content: Buffer.from(JSON.stringify(event)) } as ConsumeMessage);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
  });
});
