// SPDX-License-Identifier: FSL-1.1-MIT
import {
  createTestApplication,
  initTestApplication,
} from '@/__tests__/test-app.provider';
import '@/__tests__/matchers/to-be-string-or-null';
import type { Server } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { expect } from 'vitest';
import { createBaseTestModule } from '@/__tests__/testing-module';

describe('Get about e2e test', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const moduleRef = await createBaseTestModule();

    app = createTestApplication(moduleRef);
    await initTestApplication(app);
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
