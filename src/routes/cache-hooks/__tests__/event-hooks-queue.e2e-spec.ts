import { amqpClientFactory } from '@/__tests__/amqp-client.factory';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { retry } from '@/__tests__/util/retry';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/configuration';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ChannelWrapper } from 'amqp-connection-manager';
import { RedisClientType } from 'redis';
import { getAddress } from 'viem';
import { Server } from 'net';
import { TEST_SAFE } from '@/routes/common/__tests__/constants';

describe('Events queue processing e2e tests', () => {
  let app: INestApplication<Server>;
  let redisClient: RedisClientType;
  let channel: ChannelWrapper;
  let queueName: string;
  const cacheKeyPrefix = crypto.randomUUID();
  const queue = crypto.randomUUID();

  beforeAll(async () => {
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      amqp: {
        ...defaultConfiguration.amqp,
        queue,
      },
      features: {
        ...defaultConfiguration.features,
        eventsQueue: true,
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideProvider(CacheKeyPrefix)
      .useValue(cacheKeyPrefix)
      .compile();

    app = await new TestAppProvider().provide(moduleRef);
    await app.init();
    redisClient = await redisClientFactory();
    const amqpClient = amqpClientFactory(queue);
    channel = amqpClient.channel;
    queueName = amqpClient.queueName;
  });

  afterAll(async () => {
    await redisClient.quit();
    await channel.close();
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
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_safe_balances_${getAddress(TEST_SAFE.address)}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
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
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_multisig_transactions_${getAddress(TEST_SAFE.address)}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
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
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_multisig_transaction_${payload.safeTxHash}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
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
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_safe_${getAddress(TEST_SAFE.address)}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
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
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_safe_collectibles_${getAddress(TEST_SAFE.address)}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
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
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_transfers_${getAddress(TEST_SAFE.address)}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
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
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_incoming_transfers_${getAddress(TEST_SAFE.address)}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
  });

  it.each([
    {
      type: 'MODULE_TRANSACTION',
      module: faker.finance.ethereumAddress(),
      txHash: faker.string.hexadecimal({ length: 32 }),
    },
  ])('$type clears module transactions', async (payload) => {
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_module_transactions_${getAddress(TEST_SAFE.address)}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
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
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_all_transactions_${getAddress(TEST_SAFE.address)}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
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
    const cacheDir = new CacheDir(
      `${TEST_SAFE.chainId}_messages_${getAddress(TEST_SAFE.address)}`,
      faker.string.alpha(),
    );
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = {
      address: TEST_SAFE.address,
      chainId: TEST_SAFE.chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears chain', async (payload) => {
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(`${chainId}_chain`, '');
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = { chainId, ...payload };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
  });

  it.each([
    {
      type: 'SAFE_APPS_UPDATE',
    },
  ])('$type clears safe apps', async (payload) => {
    const cacheDir = new CacheDir(`${TEST_SAFE.chainId}_safe_apps`, '');
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const data = { chainId: TEST_SAFE.chainId, ...payload };

    await channel.sendToQueue(queueName, data);

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
  });
});
