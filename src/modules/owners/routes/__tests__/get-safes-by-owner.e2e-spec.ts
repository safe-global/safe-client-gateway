// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApplication,
  initTestApplication,
} from '#/__tests__/test-app.provider';
import { createBaseTestModule } from '#/__tests__/testing-module';
import testConfiguration from '#/config/entities/__tests__/configuration';
import configuration from '#/config/entities/configuration';
import { SafeListSchema } from '#/modules/safe/domain/entities/schemas/safe-list.schema';
import { TEST_SAFE } from '#/routes/common/__tests__/constants';

describe('Get safes by owner e2e test', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const { httpClient, safeConfig } = configuration();
    const moduleRef = await createBaseTestModule({
      config: () => ({
        ...testConfiguration(),
        httpClient,
        safeConfig,
      }),
    });

    app = createTestApplication(moduleRef);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/chains/<chain_id>/owners/<owner_address>/safes', async () => {
    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/chains/${TEST_SAFE.chainId}/owners/${TEST_SAFE.owners[0]}/safes`,
      )
      .expect(200);

    const { safes } = SafeListSchema.parse(body);
    expect(safes.length).toBeGreaterThan(0);
  });
});
