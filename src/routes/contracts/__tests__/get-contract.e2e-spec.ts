import * as request from 'supertest';
import { RedisClientType } from 'redis';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { readFileSync } from 'fs';
import { Contract } from '../entities/contract.entity';
import { redisClientFactory } from '../../../__tests__/redis-client.factory';
import { TestAppProvider } from '../../../app.provider';

describe('Get contract e2e test', () => {
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

  // TODO: test relies on the value being cached. Default cache timeout was removed.
  it.skip('GET /contracts/<address>', async () => {
    const contractAddress = '0x7cbB62EaA69F79e6873cD1ecB2392971036cFAa4';
    const expectedResponse: Contract = JSON.parse(
      readFileSync(
        'src/routes/contracts/__tests__/resources/contract-expected-response.json',
        {
          encoding: 'utf-8',
        },
      ),
    );

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/contracts/${contractAddress}`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });

    const cacheContent = await redisClient.hGet(
      `${chainId}_contract_${contractAddress}`,
      '',
    );
    expect(cacheContent).toEqual(JSON.stringify(expectedResponse));
  });

  afterAll(async () => {
    await app.close();
    await redisClient.flushAll();
    await redisClient.quit();
  });
});
