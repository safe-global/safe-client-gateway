// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { limitAndOffsetUrlFactory } from '@/domain/entities/__tests__/page.builder';
import { gasTokenBuilder } from '@/modules/fees/domain/entities/__tests__/gas-token.builder';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { rawify } from '@/validation/entities/raw.entity';

describe('Fees Controller - gas tokens', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app.close();
  });

  it('Success', async () => {
    const chainId = faker.string.numeric();
    const results = [gasTokenBuilder().build(), gasTokenBuilder().build()];
    networkService.get.mockResolvedValueOnce({
      data: rawify({ count: 2, next: null, previous: null, results }),
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/fees/gas-tokens`)
      .expect(200)
      .expect({
        count: 2,
        next: null,
        previous: null,
        results: [
          { address: results[0].address, symbol: results[0].symbol },
          { address: results[1].address, symbol: results[1].symbol },
        ],
      });

    expect(networkService.get).toHaveBeenCalledTimes(1);
    expect(networkService.get).toHaveBeenCalledWith({
      url: `${safeConfigUrl}/api/v1/chains/${chainId}/gas-tokens/`,
      networkRequest: {
        params: {
          limit: PaginationData.DEFAULT_LIMIT,
          offset: PaginationData.DEFAULT_OFFSET,
        },
      },
    });
  });

  it('preserves the priority order returned by the config service', async () => {
    const chainId = faker.string.numeric();
    const results = [
      gasTokenBuilder().with('symbol', 'USDC').build(),
      gasTokenBuilder().with('symbol', 'USDT').build(),
      gasTokenBuilder().with('symbol', 'DAI').build(),
    ];
    networkService.get.mockResolvedValueOnce({
      data: rawify({ count: 3, next: null, previous: null, results }),
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/fees/gas-tokens`)
      .expect(200)
      .expect(({ body }) => {
        expect(
          body.results.map((gasToken: { symbol: string }) => gasToken.symbol),
        ).toEqual(['USDC', 'USDT', 'DAI']);
      });
  });

  it('maps the config pagination to cursor URLs', async () => {
    const chainId = faker.string.numeric();
    const results = [gasTokenBuilder().build()];
    const next = limitAndOffsetUrlFactory(
      20,
      20,
      faker.internet.url({ appendSlash: false }),
    );
    const previous = limitAndOffsetUrlFactory(
      20,
      0,
      faker.internet.url({ appendSlash: false }),
    );
    networkService.get.mockResolvedValueOnce({
      data: rawify({ count: 40, next, previous, results }),
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/fees/gas-tokens`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.next).toContain('cursor=limit%3D20%26offset%3D20');
        expect(body.previous).toContain('cursor=limit%3D20%26offset%3D0');
      });
  });

  it('should exclude gas tokens that fail validation', async () => {
    const chainId = faker.string.numeric();
    const valid = gasTokenBuilder().build();
    networkService.get.mockResolvedValueOnce({
      data: rawify({
        count: 2,
        next: null,
        previous: null,
        results: [valid, { address: 'invalid', symbol: 123 }],
      }),
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/fees/gas-tokens`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.results).toEqual([
          { address: valid.address, symbol: valid.symbol },
        ]);
      });
  });

  it('Failure: network service fails', async () => {
    const chainId = faker.string.numeric();
    const error = new NetworkResponseError(
      new URL(`${safeConfigUrl}/api/v1/chains/${chainId}/gas-tokens/`),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/fees/gas-tokens`)
      .expect(500)
      .expect({ message: 'An error occurred', code: 500 });
  });
});
