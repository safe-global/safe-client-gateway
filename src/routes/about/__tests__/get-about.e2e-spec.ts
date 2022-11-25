import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('Get about e2e test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('GET /about', async () => {
    await request(app.getHttpServer())
      .get(`/about`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            name: expect.any(String),
            version: expect.any(String),
            buildNumber: expect.any(String),
          }),
        );
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
