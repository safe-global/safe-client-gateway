// SPDX-License-Identifier: FSL-1.1-MIT
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress, type PublicClient } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { erc20ApprovalLogEncoder } from '#/modules/token-approvals/domain/entities/__tests__/approval-log-encoder.builder';
import { erc20TokenBuilder } from '#/modules/tokens/domain/__tests__/token.builder';
import { rawify } from '#/validation/entities/raw.entity';

describe('Token approvals controller', () => {
  const cachedClient = {
    request: vi.fn(),
  } as MockedObject<PublicClient>;
  const uncachedClient = {
    getBlockNumber: vi.fn(),
    multicall: vi.fn(),
  } as MockedObject<PublicClient>;

  describe('with the feature on', () => {
    let app: INestApplication<Server>;
    let safeConfigUrl: string;
    let networkService: MockedObject<INetworkService>;
    let blockchainApiManager: IBlockchainApiManager;

    beforeAll(async () => {
      const moduleFixture = await createTestModule();
      safeConfigUrl = moduleFixture
        .get<IConfigurationService>(IConfigurationService)
        .getOrThrow('safeConfig.baseUri');
      networkService = moduleFixture.get(NetworkService);
      blockchainApiManager = moduleFixture.get(IBlockchainApiManager);
      app = await new TestAppProvider().provide(moduleFixture);
      await initTestApplication(app);
    });

    afterAll(async () => {
      await app?.close();
    });

    beforeEach(() => {
      vi.resetAllMocks();
      vi.spyOn(blockchainApiManager, 'getApi').mockResolvedValue(cachedClient);
      vi.spyOn(blockchainApiManager, 'getUncachedApi').mockResolvedValue(
        uncachedClient,
      );
    });

    it('should, when the Safe gave an allowance above zero, return it with its token metadata', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const token = erc20TokenBuilder().build();
      const spender = getAddress(faker.finance.ethereumAddress());
      const allowance = faker.number.bigInt({ min: 1n });
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v1/tokens/${token.address}/`:
            return Promise.resolve({ data: rawify(token), status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });
      uncachedClient.getBlockNumber.mockResolvedValue(
        faker.number.bigInt({ min: 1n, max: 20_000_000n }),
      );
      cachedClient.request.mockResolvedValue([
        erc20ApprovalLogEncoder()
          .with('tokenAddress', token.address)
          .with('owner', safeAddress)
          .with('spender', spender)
          .encode(),
      ]);
      uncachedClient.multicall.mockResolvedValue([
        { status: 'success', result: allowance },
      ]);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safeAddress}/token-approvals`)
        .expect(200)
        .expect({
          approvals: [
            {
              tokenAddress: token.address,
              tokenMetadata: token,
              spender,
              allowance: allowance.toString(),
            },
          ],
          isComplete: true,
        });
    });

    it('should, when the Safe address is invalid, reject the request with 422', async () => {
      await request(app.getHttpServer())
        .get(
          `/v1/chains/${faker.string.numeric()}/safes/${faker.string.alphanumeric()}/token-approvals`,
        )
        .expect(422);

      expect(blockchainApiManager.getApi).not.toHaveBeenCalled();
    });

    it('should, when the chain id is invalid, reject the request with 422', async () => {
      await request(app.getHttpServer())
        .get(
          `/v1/chains/${faker.string.alpha()}/safes/${getAddress(faker.finance.ethereumAddress())}/token-approvals`,
        )
        .expect(422);

      expect(blockchainApiManager.getApi).not.toHaveBeenCalled();
    });
  });

  describe('with a rate limit of one request', () => {
    let app: INestApplication<Server>;
    let blockchainApiManager: IBlockchainApiManager;

    beforeAll(async () => {
      const defaultConfiguration = configuration();
      const moduleFixture = await createTestModule({
        config: () => ({
          ...defaultConfiguration,
          tokenApprovals: {
            ...defaultConfiguration.tokenApprovals,
            rateLimit: {
              ...defaultConfiguration.tokenApprovals.rateLimit,
              max: 1,
            },
          },
        }),
      });
      blockchainApiManager = moduleFixture.get(IBlockchainApiManager);
      app = await new TestAppProvider().provide(moduleFixture);
      await initTestApplication(app);
    });

    afterAll(async () => {
      await app?.close();
    });

    it('should, when the limit is reached, reject the next request with 429', async () => {
      vi.spyOn(blockchainApiManager, 'getApi').mockResolvedValue(cachedClient);
      vi.spyOn(blockchainApiManager, 'getUncachedApi').mockResolvedValue(
        uncachedClient,
      );
      uncachedClient.getBlockNumber.mockResolvedValue(
        faker.number.bigInt({ min: 1n, max: 20_000_000n }),
      );
      cachedClient.request.mockResolvedValue([]);
      const url = `/v1/chains/${faker.string.numeric()}/safes/${getAddress(faker.finance.ethereumAddress())}/token-approvals`;

      await request(app.getHttpServer()).get(url).expect(200);
      await request(app.getHttpServer())
        .get(url)
        .expect(429)
        .expect('Rate limit reached');
    });
  });

  describe('with the feature off', () => {
    let app: INestApplication<Server>;

    beforeAll(async () => {
      const defaultConfiguration = configuration();
      const moduleFixture = await createTestModule({
        config: () => ({
          ...defaultConfiguration,
          features: {
            ...defaultConfiguration.features,
            tokenApprovals: false,
          },
        }),
      });
      app = await new TestAppProvider().provide(moduleFixture);
      await initTestApplication(app);
    });

    afterAll(async () => {
      await app?.close();
    });

    it('should, when the route is requested, answer 404 because it is not registered', async () => {
      await request(app.getHttpServer())
        .get(
          `/v1/chains/${faker.string.numeric()}/safes/${getAddress(faker.finance.ethereumAddress())}/token-approvals`,
        )
        .expect(404);
    });
  });
});
