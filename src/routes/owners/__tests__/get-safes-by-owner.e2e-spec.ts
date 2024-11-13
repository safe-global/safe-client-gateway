import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { RedisClientType } from 'redis';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import type { Server } from 'net';
import { TEST_SAFE } from '@/routes/common/__tests__/constants';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';

describe('Get safes by owner e2e test', () => {
  let app: INestApplication<Server>;
  let redisClient: RedisClientType;
  const cacheKeyPrefix = crypto.randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register()],
    })
      .overrideProvider(CacheKeyPrefix)
      .useValue(cacheKeyPrefix)
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    redisClient = await redisClientFactory();
  });

  afterAll(async () => {
    await app.close();
    await redisClient.quit();
  });

  it('GET /owners/<owner_address>/safes', async () => {
    const ownerCacheKey = `${cacheKeyPrefix}-${TEST_SAFE.chainId}_owner_safes_${TEST_SAFE.owners[0]}`;

    await request(app.getHttpServer())
      .get(`/chains/${TEST_SAFE.chainId}/owners/${TEST_SAFE.owners[0]}/safes`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            safes: expect.arrayContaining([TEST_SAFE.address]),
          }),
        );
      });

    const cacheContent = await redisClient.hGet(ownerCacheKey, '');
    expect(cacheContent).toBeNull();
  });
});
