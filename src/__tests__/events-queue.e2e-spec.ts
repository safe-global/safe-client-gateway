import { amqpClientFactory } from '@/__tests__/amqp-client.factory';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { retry } from '@/__tests__/retry';
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

describe('Events queue processing e2e tests', () => {
  let app: INestApplication;
  let redisClient: RedisClientType;
  let channel: ChannelWrapper;
  let queueName: string;
  const cacheKeyPrefix = crypto.randomUUID();

  beforeAll(async () => {
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
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
    const amqpClient = await amqpClientFactory();
    channel = amqpClient.channel;
    queueName = amqpClient.queueName;
  });

  afterAll(async () => {
    await app.close();
    await redisClient.quit();
    await channel.close();
  });

  it.each([
    {
      type: 'SAFE_APPS_UPDATE',
    },
  ])('$type clears safe apps', async (payload) => {
    const chainId = faker.string.numeric();
    const cacheDir = new CacheDir(`${chainId}_safe_apps`, '');
    await redisClient.hSet(
      `${cacheKeyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      faker.string.alpha(),
    );
    const msg = {
      chainId: chainId,
      ...payload,
    };

    await channel.sendToQueue(queueName, Buffer.from(JSON.stringify(msg)));

    await retry(async () => {
      const cacheContent = await redisClient.hGet(
        `${cacheKeyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
      expect(cacheContent).toBeNull();
    });
  });
});
