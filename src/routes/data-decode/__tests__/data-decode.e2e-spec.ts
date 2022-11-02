import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { RedisClientType } from 'redis';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { DataDecoded } from '../../../domain/data-decoder/entities/data-decoded.entity';
import { redisClientFactory } from '../../../__tests__/redis-client.factory';
import { CreateDataDecodedDto } from '../entities/create-data-decoded.dto';

describe('Data decode e2e tests', () => {
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

  it('POST /data-decoder', async () => {
    const requestBody: CreateDataDecodedDto = JSON.parse(
      readFileSync(
        'src/routes/data-decode/__tests__/resources/data-decode-request-body.json',
        {
          encoding: 'utf-8',
        },
      ),
    );
    const expectedResponse: DataDecoded = JSON.parse(
      readFileSync(
        'src/routes/data-decode/__tests__/resources/data-decode-expected-response.json',
        {
          encoding: 'utf-8',
        },
      ),
    );

    await request(app.getHttpServer())
      .post(`/chains/${chainId}/data-decoder`)
      .send(requestBody)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });
  });

  afterAll(async () => {
    await app.close();
    await redisClient.flushAll();
    await redisClient.quit();
  });
});
