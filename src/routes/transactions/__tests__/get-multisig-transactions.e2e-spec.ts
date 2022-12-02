import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { RedisClientType } from 'redis';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { redisClientFactory } from '../../../__tests__/redis-client.factory';

describe('Get contract e2e test', () => {
  let app: INestApplication;
  let redisClient: RedisClientType;
  const chainId = '1'; // TODO: change this to Görli testnet

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

  it.skip('GET /safes/<address>/multisig-transactions', async () => {
    const safeAddress = '0x84443F61efc60D10DA9F9a2398980CD5748394BB';
    const executionDateGte = '2020-06-09T00:00:00.000Z';
    const executionDateLte = '2020-06-12T00:00:00.000Z';
    const cacheKey = `${chainId}_${safeAddress}_multisig_transactions`;
    const cacheKeyField = `-modified_undefined_true_${executionDateGte}_${executionDateLte}_undefined_undefined_undefined_undefined_undefined`;
    const expectedResponse = getJsonResource('e2e/expected-response.json');

    await request(app.getHttpServer())
      .get(
        `/chains/${chainId}/safes/${safeAddress}/multisig-transactions?execution_date__gte=${executionDateGte}&execution_date__lte=${executionDateLte}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });

    const cacheContent = await redisClient.hGet(cacheKey, cacheKeyField);
    expect(cacheContent).toEqual(JSON.stringify(expectedResponse));
  });

  afterAll(async () => {
    await app.close();
    await redisClient.flushAll();
    await redisClient.quit();
  });
});

const getJsonResource = (relativePath: string) => {
  const basePath = 'src/routes/transactions/__tests__/resources';
  return JSON.parse(readFileSync(`${basePath}/${relativePath}`, 'utf8'));
};
