// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import configuration from '#/config/entities/__tests__/configuration';
import { NetworkResponseError } from '#/datasources/network/entities/network.error.entity';
import {
  type INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import { rawify } from '#/validation/entities/raw.entity';

describe('Portfolio Controller', () => {
  describe('with features.zerion=false', () => {
    let app: INestApplication<Server>;

    beforeAll(async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          zerion: false,
        },
      });

      const moduleFixture = await createTestModule({
        config: testConfiguration,
      });
      app = await new TestAppProvider().provide(moduleFixture);
      await initTestApplication(app);
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
        .query({ chainId: faker.string.numeric() })
        .expect(403);
    });
  });

  describe('with features.zerion=true', () => {
    const rateLimitMax = 3;
    let app: INestApplication<Server>;
    let networkService: MockedObject<INetworkService>;
    let safeConfigUrl: string;

    function mockSafe(args: { chain: Chain; address: Address }): void {
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${args.chain.chainId}`:
            return Promise.resolve({ data: rawify(args.chain), status: 200 });
          case `${args.chain.transactionService}/api/v1/safes/${args.address}`:
            return Promise.resolve({
              data: rawify(safeBuilder().with('address', args.address).build()),
              status: 200,
            });
          default:
            return Promise.reject(
              new NetworkResponseError(new URL(url), {
                status: 404,
              } as Response),
            );
        }
      });
    }

    beforeEach(async () => {
      vi.resetAllMocks();
      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          zerion: true,
        },
        portfolio: {
          ...defaultConfiguration.portfolio,
          clear: {
            ...defaultConfiguration.portfolio.clear,
            rateLimit: {
              ...defaultConfiguration.portfolio.clear.rateLimit,
              max: rateLimitMax,
            },
          },
        },
      });
      safeConfigUrl = defaultConfiguration.safeConfig.baseUri;

      const moduleFixture = await createTestModule({
        config: testConfiguration,
      });
      networkService = moduleFixture.get(NetworkService);
      app = await new TestAppProvider().provide(moduleFixture);
      await initTestApplication(app);
    });

    afterEach(async () => {
      await app.close();
    });

    it('DELETE /v1/portfolio/:address clears the caches of a Safe', async () => {
      const chain = chainBuilder().build();
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafe({ chain, address });

      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${address}`)
        .query({ chainId: chain.chainId })
        .expect(204);
    });

    it('DELETE /v1/portfolio/:address returns 404 for an address that is not a Safe', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const otherAddress = getAddress(faker.finance.ethereumAddress());
      mockSafe({ chain, address: safeAddress });

      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${otherAddress}`)
        .query({ chainId: chain.chainId })
        .expect(404);
    });

    it('DELETE /v1/portfolio/:address returns 422 without chainId', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${address}`)
        .expect(422);

      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('DELETE /v1/portfolio/:address returns 429 once the rate limit is reached', async () => {
      const chain = chainBuilder().build();
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafe({ chain, address });

      for (let i = 0; i < rateLimitMax; i++) {
        await request(app.getHttpServer())
          .delete(`/v1/portfolio/${address}`)
          .query({ chainId: chain.chainId })
          .expect(204);
      }
      await request(app.getHttpServer())
        .delete(`/v1/portfolio/${address}`)
        .query({ chainId: chain.chainId })
        .expect(429);
    });
  });
});
