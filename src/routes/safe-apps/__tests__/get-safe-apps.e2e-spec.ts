import * as request from 'supertest';
import { RedisClientType } from 'redis';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { redisClientFactory } from '../../../__tests__/redis-client.factory';
import { TestAppProvider } from '../../../app.provider';

describe('Get Safe Apps e2e test', () => {
  let app: INestApplication;
  let redisClient: RedisClientType;
  const chainId = '5'; // Görli testnet

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await new TestAppProvider().provide(moduleRef);
    await app.init();
    redisClient = await redisClientFactory();
  });

  beforeEach(async () => {
    await redisClient.flushAll();
  });

  it('GET /chains/<chainId>/safe-apps', async () => {
    const safeAppsCacheKey = `${chainId}_safe_apps`;
    const safeAppsCacheField = 'undefined_undefined';

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safe-apps`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expect.any(Array));
        body.map((safeApp) =>
          expect(safeApp).toEqual(
            expect.objectContaining({
              id: expect.any(Number),
              name: expect.any(String),
              url: expect.any(String),
              chainIds: expect.arrayContaining([chainId]),
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
    const safeAppsCacheKey = `${chainId}_safe_apps`;
    const transactionBuilderUrl = 'https://safe-apps.dev.5afe.dev/tx-builder';
    const safeAppsCacheField = `undefined_${transactionBuilderUrl}`;

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safe-apps/?url=${transactionBuilderUrl}`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expect.any(Array));
        expect(body.length).toBe(1);
        expect(body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            name: 'Transaction Builder',
            url: transactionBuilderUrl,
            chainIds: expect.arrayContaining([chainId]),
          }),
        );
      });

    const cacheContent = await redisClient.hGet(
      safeAppsCacheKey,
      safeAppsCacheField,
    );
    expect(cacheContent).not.toBeNull();
  });

  afterAll(async () => {
    await app.close();
    await redisClient.flushAll();
    await redisClient.quit();
  });
});
