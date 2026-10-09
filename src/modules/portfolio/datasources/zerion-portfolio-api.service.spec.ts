// SPDX-License-Identifier: FSL-1.1-MIT

import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { IConfigurationService } from '#/config/configuration.service.interface';
import type { ICacheService } from '#/datasources/cache/cache.service.interface';
import type { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { NetworkResponseError } from '#/datasources/network/entities/network.error.entity';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { LogType } from '#/domain/common/entities/log-type.entity';
import { DataSourceError } from '#/domain/errors/data-source.error';
import type { ILoggingService } from '#/logging/logging.interface';
import { ZerionPortfolioApi } from '#/modules/portfolio/datasources/zerion-portfolio-api.service';
import type { ZerionChainMappingService } from '#/modules/zerion/datasources/zerion-chain-mapping.service';
import { rawify } from '#/validation/entities/raw.entity';

describe('ZerionPortfolioApi', () => {
  let service: ZerionPortfolioApi;
  let fakeConfigurationService: FakeConfigurationService;

  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });
  const supportedFiatCodes = ['USD', 'EUR'];

  const mockNetworkService = mocked({
    get: jest.fn(),
    post: jest.fn(),
    postForm: jest.fn(),
    delete: jest.fn(),
  } as MockedObject<INetworkService>);

  const mockHttpErrorFactory = mocked({
    from: jest.fn(),
  } as MockedObject<HttpErrorFactory>);

  const mockLoggingService = mocked({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as MockedObject<ILoggingService>);

  const mockCacheService = mocked({
    hGet: jest.fn(),
    hSet: jest.fn(),
    deleteByKey: jest.fn(),
  } as MockedObject<ICacheService>);

  const mockChainMappingService = mocked({
    getNetworkFromChainId: jest.fn(),
    getChainIdFromNetwork: jest.fn(),
  } as MockedObject<ZerionChainMappingService>);

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.zerion.assetsApiKey',
      zerionApiKey,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.baseUri',
      zerionBaseUri,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.currencies',
      supportedFiatCodes,
    );
    fakeConfigurationService.set('features.zerionTestnets', false);

    service = new ZerionPortfolioApi(
      mockNetworkService,
      fakeConfigurationService as IConfigurationService,
      mockHttpErrorFactory,
      mockLoggingService,
      mockCacheService,
      mockChainMappingService,
    );
  });

  describe('getPortfolio', () => {
    it('returns an empty portfolio and calls no upstream for testnet chains', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      const portfolio = await service.getPortfolio({
        address,
        fiatCode: 'USD',
        isTestnet: true,
      });

      expect(portfolio).toMatchObject({
        totalBalanceFiat: '0',
        tokenBalances: [],
        positionBalances: [],
      });
      expect(mockNetworkService.get).not.toHaveBeenCalled();
    });

    it('fetches testnet chains from Zerion when testnets are enabled', async () => {
      fakeConfigurationService.set('features.zerionTestnets', true);
      service = new ZerionPortfolioApi(
        mockNetworkService,
        fakeConfigurationService as IConfigurationService,
        mockHttpErrorFactory,
        mockLoggingService,
        mockCacheService,
        mockChainMappingService,
      );
      const address = getAddress(faker.finance.ethereumAddress());
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [] }),
        status: 200,
      });

      await service.getPortfolio({ address, fiatCode: 'USD', isTestnet: true });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/wallets/${address}/positions`,
        networkRequest: expect.objectContaining({
          headers: expect.objectContaining({ 'X-Env': 'testnet' }),
        }),
      });
    });

    it.each([true, false])(
      'should log portfolio request failures with trusted=%s',
      async (trusted) => {
        const address = getAddress(faker.finance.ethereumAddress());
        const fiatCode = 'USD';
        const sourceError = new NetworkResponseError(
          new URL(`${zerionBaseUri}/v1/wallets/${address}/positions`),
          new Response(null, { status: 401, statusText: 'Unauthorized' }),
          {
            errors: [
              {
                code: 'unauthorized',
                title: 'Unauthorized',
                detail: 'Invalid Zerion API key',
              },
            ],
          },
        );
        const dataSourceError = new DataSourceError('Unauthorized', 401);
        mockNetworkService.get.mockRejectedValue(sourceError);
        mockHttpErrorFactory.from.mockReturnValue(dataSourceError);

        await expect(
          service.getPortfolio({
            address,
            fiatCode,
            trusted,
            isTestnet: false,
            sync: true,
          }),
        ).rejects.toBe(dataSourceError);

        expect(mockLoggingService.error).toHaveBeenCalledWith({
          type: LogType.PortfolioRequestError,
          source: 'ZerionPortfolioApi',
          event: 'Portfolio request failed',
          safeAddress: address,
          fiatCode,
          trusted,
          sync: true,
          isTestnet: false,
          request_status: 401,
          detail: 'Invalid Zerion API key',
        });
        expect(
          JSON.stringify(mockLoggingService.error.mock.calls[0][0]),
        ).not.toContain(zerionApiKey);
        expect(
          JSON.stringify(mockLoggingService.error.mock.calls[0][0]),
        ).not.toContain('Authorization');
      },
    );
  });
});
