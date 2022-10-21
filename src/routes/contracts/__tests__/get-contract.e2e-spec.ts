import * as request from 'supertest';
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { readFileSync } from 'fs';
import { Contract } from '../entities/contract.entity';
import { RedisClientType, createClient } from 'redis';

const logger = new Logger(redisClientFactory.name);

async function redisClientFactory(): Promise<RedisClientType> {
  const { REDIS_HOST = 'localhost', REDIS_PORT = 6379 } = process.env;
  const client: RedisClientType = createClient({
    url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  });
  client.on('error', (err) => logger.error('Redis Client Error', err));
  client.connect();
  return client;
}

describe('Get contract e2e test', () => {
  let app: INestApplication;
  let redisClient: RedisClientType;
  const chainId = '5'; // Görli testnet

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    redisClient = await redisClientFactory();
    await app.init();
  });

  it('GET /contracts/<address>', async () => {
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
      .get(`/chains/${chainId}/contracts/${contractAddress}`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });
  });

  afterAll(async () => {
    await app.close();
    await redisClient.quit();
  });
});
