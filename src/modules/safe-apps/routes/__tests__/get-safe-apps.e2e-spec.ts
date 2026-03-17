import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import type { SafeApp } from '@/modules/safe-apps/routes/entities/safe-app.entity';
import type { Server } from 'net';
import { createBaseTestModule } from '@/__tests__/testing-module';
import type { RedisClientType } from '@/datasources/cache/cache.module';

describe('Get Safe Apps e2e test', () => {
  let app: INestApplication<Server>;
  let redisClient: RedisClientType;
  const chainId = '1'; // Mainnet
  const cacheKeyPrefix = crypto.randomUUID();

  beforeAll(async () => {
    const moduleRef = await createBaseTestModule({ cacheKeyPrefix });

    app = await new TestAppProvider().provide(moduleRef);
    await app.init();
    redisClient = await redisClientFactory();
  });

  afterAll(async () => {
    await app.close();
    await redisClient.quit();
  });

  it('GET /chains/<chainId>/safe-apps', async () => {
    const safeAppsCacheKey = `${cacheKeyPrefix}-${chainId}_safe_apps`;
    const safeAppsCacheField = 'undefined_true_undefined';

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safe-apps`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toBeInstanceOf(Array);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        body.forEach((safeApp: SafeApp) =>
          expect(safeApp).toEqual(
            expect.objectContaining({
              id: expect.any(Number),
              name: expect.any(String),
              url: expect.any(String),
              chainIds: expect.arrayContaining([chainId]),
              iconUrl: expect.any(String),
              description: expect.any(String),
              accessControl: expect.objectContaining({
                type: expect.any(String),
              }),
              tags: expect.any(Array),
              features: expect.any(Array),
              socialProfiles: expect.any(Array),
            }),
          ),
        );
      });

    const cacheContent = await redisClient.hGet(
      safeAppsCacheKey,
      safeAppsCacheField,
    );
    expect(cacheContent).not.toBeNull();
  });

  it('GET /chains/<chainId>/safe-apps?url=${transactionBuilderUrl}', async () => {
    const safeAppsCacheKey = `${cacheKeyPrefix}-${chainId}_safe_apps`;
    const transactionBuilderUrl = 'https://safe-apps.dev.5afe.dev/tx-builder';
    const safeAppsCacheField = `undefined_true_${transactionBuilderUrl}`;

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safe-apps/?url=${transactionBuilderUrl}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toBeInstanceOf(Array);
        expect(body.length).toBe(1);
        expect(body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            name: 'Transaction Builder',
            url: transactionBuilderUrl,
            chainIds: expect.arrayContaining([chainId]),
            iconUrl: expect.any(String),
            description: expect.any(String),
            accessControl: expect.objectContaining({
              type: expect.any(String),
            }),
            tags: expect.any(Array),
            features: expect.any(Array),
            socialProfiles: expect.any(Array),
          }),
        );
      });

    const cacheContent = await redisClient.hGet(
      safeAppsCacheKey,
      safeAppsCacheField,
    );
    expect(cacheContent).not.toBeNull();
  });
});
