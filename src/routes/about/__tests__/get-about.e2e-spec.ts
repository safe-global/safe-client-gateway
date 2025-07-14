import '@/__tests__/matchers/to-be-string-or-null';
import { createBaseTestModule } from '@/__tests__/testing-module';
import { expect } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import request from 'supertest';

describe('Get about e2e test', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const moduleRef = await createBaseTestModule();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /about', async () => {
    await request(app.getHttpServer())
      .get(`/about`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            name: expect.any(String),
            version: expect.anyStringOrNull(),
            buildNumber: expect.anyStringOrNull(),
          }),
        );
      });
  });
});
