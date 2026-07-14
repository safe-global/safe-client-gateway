// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';

describe('Portfolio Controller', () => {
  describe('with features.zerionEnabled=false', () => {
    let app: INestApplication<Server>;

    beforeAll(async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          zerionEnabled: false,
        },
      });

      const moduleFixture = await createTestModule({
        config: testConfiguration,
      });
      app = await new TestAppProvider().provide(moduleFixture);
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /v1/portfolio/:address returns 403', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .get(`/v1/portfolio/${address}`)
        .expect(403);
    });

    it('DELETE /v1/portfolio/:address returns 403', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${address}`)
        .expect(403);
    });
  });

  describe('with features.zerionEnabled=true', () => {
    let app: INestApplication<Server>;

    beforeAll(async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          zerionEnabled: true,
        },
      });

      const moduleFixture = await createTestModule({
        config: testConfiguration,
      });
      app = await new TestAppProvider().provide(moduleFixture);
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('DELETE /v1/portfolio/:address is not blocked by the guard', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${address}`)
        .expect(204);
    });
  });
});
