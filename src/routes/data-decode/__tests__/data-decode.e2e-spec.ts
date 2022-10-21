import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { readFileSync } from 'fs';
import { CreateDataDecodedDto } from '../entities/create-data-decoded.dto';
import { DataDecoded } from '../../../domain/data-decoder/entities/data-decoded.entity';

describe('Data decode e2e tests', () => {
  let app: INestApplication;
  const chainId = '5'; // Görli testnet

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
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
  });
});
