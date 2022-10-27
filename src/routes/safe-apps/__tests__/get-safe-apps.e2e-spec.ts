import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { readFileSync } from 'fs';
import { RedisClientType, createClient } from 'redis';
import { SafeApp } from '../entities/safe-app.entity';

describe('Get Safe Apps e2e test', () => {
  let app: INestApplication;
  let redisClient: RedisClientType;
  const chainId = '5'; // Görli testnet

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    redisClient = await redisClientFactory();
  });

  beforeEach(async () => {
    await redisClient.flushAll();
  });

  it('GET /chains/<chainId>/safe-apps', async () => {
    const safeAppsCacheKey = `${chainId}_safe_apps`;
    const safeAppsCacheField = 'undefined_undefined';
    const expectedResponse: SafeApp[] = JSON.parse(
      readFileSync(
        'src/routes/safe-apps/__tests__/resources/get-all-safe-apps-expected-response.json',
        {
          encoding: 'utf-8',
        },
      ),
    );

    await request(app.getHttpServer())
      .get(`/chains/${chainId}/safe-apps`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });

    const cacheContent = await redisClient.hGet(
      safeAppsCacheKey,
      safeAppsCacheField,
    );
    expect(cacheContent).toBeDefined();
  });

  it('GET /chains/<chainId>/safe-apps?url=https://app.ens.domains', async () => {
    const safeAppsCacheKey = `${chainId}_safe_apps`;
    const safeAppsCacheField = 'undefined_https://app.ens.domains';
    const expectedResponse: SafeApp[] = JSON.parse(
      readFileSync(
        'src/routes/safe-apps/__tests__/resources/get-safe-apps-filtered-by-url-expected-response.json',
        {
          encoding: 'utf-8',
        },
      ),
    );

    await request(app.getHttpServer())
      .get(`/chains/${chainId}/safe-apps/?url=https://app.ens.domains`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });

    const cacheContent = await redisClient.hGet(
      safeAppsCacheKey,
      safeAppsCacheField,
    );
    expect(cacheContent).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
    await redisClient.flushAll();
    await redisClient.quit();
  });
});

async function redisClientFactory(): Promise<RedisClientType> {
  const { REDIS_HOST = 'localhost', REDIS_PORT = 6379 } = process.env;
  const client: RedisClientType = createClient({
    url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  });
  client.connect();
  return client;
}
