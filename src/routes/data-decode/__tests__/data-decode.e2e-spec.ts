import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { RedisClientType } from 'redis';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { TestAppProvider } from '../../../app.provider';
import { DataDecoded } from '../../../domain/data-decoder/entities/data-decoded.entity';
import { redisClientFactory } from '../../../__tests__/redis-client.factory';
import { GetDataDecodedDto } from '../entities/get-data-decoded.dto.entity';

describe('Data decode e2e tests', () => {
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

  it('POST /data-decoder', async () => {
    const requestBody: GetDataDecodedDto = JSON.parse(
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
      .post(`/v1/chains/${chainId}/data-decoder`)
      .send(requestBody)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });
  });

  it('POST /data-decoder should throw a validation error', async () => {
    const requestBody: GetDataDecodedDto = JSON.parse(
      readFileSync(
        'src/routes/data-decode/__tests__/resources/data-decode-request-body.json',
        {
          encoding: 'utf-8',
        },
      ),
    );

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/data-decoder`)
      .send({ ...requestBody, to: faker.number.int() })
      .expect(400)
      .expect({ message: 'Validation failed', code: 42, arguments: [] });
  });

  it('POST /data-decoder should throw a validation error (2)', async () => {
    const requestBody: GetDataDecodedDto = JSON.parse(
      readFileSync(
        'src/routes/data-decode/__tests__/resources/data-decode-request-body.json',
        {
          encoding: 'utf-8',
        },
      ),
    );

    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/data-decoder`)
      .send({ ...requestBody, to: faker.string.alphanumeric() })
      .expect(400)
      .expect({ message: 'Validation failed', code: 42, arguments: [] });
  });

  afterAll(async () => {
    await app.close();
    await redisClient.flushAll();
    await redisClient.quit();
  });
});
