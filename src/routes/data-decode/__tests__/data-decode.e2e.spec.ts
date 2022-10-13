import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { readFileSync } from 'fs';

describe('Portfolios e2e tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('should init the app', () => {
    expect(app).toBeDefined();
  });

  it('POST /data-decoder', async () => {
    const requestBody = JSON.parse(
      readFileSync(
        'src/routes/data-decode/__tests__/resources/data-decode-request-body.json',
        {
          encoding: 'utf-8',
        },
      ),
    );
    const expectedResponse = JSON.parse(
      readFileSync(
        'src/routes/data-decode/__tests__/resources/data-decode-expected-response.json',
        {
          encoding: 'utf-8',
        },
      ),
    );

    await request(app.getHttpServer())
      .post('/chains/1/data-decoder')
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
