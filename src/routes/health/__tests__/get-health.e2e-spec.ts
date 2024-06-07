import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { Server } from 'net';

describe('Get health e2e test', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const cacheKeyPrefix = crypto.randomUUID();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register()],
    })
      .overrideProvider(CacheKeyPrefix)
      .useValue(cacheKeyPrefix)
      .compile();
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
