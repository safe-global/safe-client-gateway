import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { TestAppProvider } from '../../../app.provider';

describe('Get health e2e test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = await new TestAppProvider().provide(moduleRef);
    await app.init();
  });

  it('GET /health', async () => {
    await request(app.getHttpServer())
      .get(`/health`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual({ status: 'OK' });
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
