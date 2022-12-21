import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { RedisClientType } from 'redis';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { redisClientFactory } from '../../../__tests__/redis-client.factory';

describe('Get module transactions e2e test', () => {
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

  it('GET /safes/<address>/module-transactions (native token)', async () => {
    const safeAddress = '0x4127839cdf4F73d9fC9a2C2861d8d1799e9DF40C';
    const cacheKey = `${chainId}_${safeAddress}_module_transactions`;
    const cacheKeyField = `undefined_undefined_undefined_undefined`;
    const expectedResponse = getJsonResource(
      'e2e/module-transactions/native-token-expected-response.json',
    );

    await request(app.getHttpServer())
      .get(`/chains/${chainId}/safes/${safeAddress}/module-transactions`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });

    const cacheContent = await redisClient.hGet(cacheKey, cacheKeyField);
    expect(cacheContent).not.toBeNull();
  }, 60000);

  afterAll(async () => {
    await app.close();
    await redisClient.flushAll();
    await redisClient.quit();
  });
});

const getJsonResource = (relativePath: string) => {
  const basePath =
    'src/routes/transactions/__tests__/resources/multisig-transactions';
  return JSON.parse(readFileSync(`${basePath}/${relativePath}`, 'utf8'));
};
