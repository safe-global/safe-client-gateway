import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import type { Server } from 'net';
import { createBaseTestModule } from '@/__tests__/testing-module';

describe('Get health e2e test', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const moduleRef = await createBaseTestModule();

    app = await new TestAppProvider().provide(moduleRef);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live', async () => {
    await request(app.getHttpServer())
      .get(`/health/live`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual({ status: 'OK' });
      });
  });
});
