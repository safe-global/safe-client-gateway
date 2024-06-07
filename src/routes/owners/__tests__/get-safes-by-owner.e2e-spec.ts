import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RedisClientType } from 'redis';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { Server } from 'net';
import { getAddress } from 'viem';

describe('Get safes by owner e2e test', () => {
  let app: INestApplication<Server>;
  let redisClient: RedisClientType;
  const chainId = '1'; // Mainnet
  const ownerAddress = getAddress('0x6c15f69EE76DA763e5b5DB6f7f0C29eb625bc9B7');
  const safeAddress = getAddress('0x8675B754342754A30A2AeF474D114d8460bca19b');
  const cacheKeyPrefix = crypto.randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register()],
    })
      .overrideProvider(CacheKeyPrefix)
      .useValue(cacheKeyPrefix)
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
    const ownerCacheKey = `${cacheKeyPrefix}-${chainId}_owner_safes_${ownerAddress}`;

    await request(app.getHttpServer())
      .get(`/chains/${chainId}/owners/${ownerAddress}/safes`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            safes: expect.arrayContaining([safeAddress]),
          }),
        );
      });

    const cacheContent = await redisClient.hGet(ownerCacheKey, '');
    expect(cacheContent).toBeNull();
  });
});
