import type { INestApplication } from '@nestjs/common';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import request from 'supertest';
import type { Server } from 'net';
import { createTestModule } from '@/__tests__/testing-module';

describe('Root Controller tests', () => {
  let app: INestApplication<Server>;

  beforeEach(async () => {
    const moduleFixture = await createTestModule();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  it('should redirect / to /api', async () => {
    await request(app.getHttpServer())
      .get(`/`)
      .expect(302)
      .expect((res) => {
        expect(res.get('location')).toBe('/api');
      });
  });
});
