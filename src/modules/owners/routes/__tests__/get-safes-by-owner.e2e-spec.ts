import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import type { Server } from 'net';
import { TEST_SAFE } from '@/routes/common/__tests__/constants';
import { createBaseTestModule } from '@/__tests__/testing-module';
import type { RedisClientType } from '@/datasources/cache/cache.module';

describe('Get safes by owner e2e test', () => {
  let app: INestApplication<Server>;
  let redisClient: RedisClientType;
  const cacheKeyPrefix = crypto.randomUUID();

  beforeAll(async () => {
    const moduleRef = await createBaseTestModule();

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
