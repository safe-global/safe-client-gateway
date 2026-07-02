// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { ILoggingService } from '@/logging/logging.interface';
import { ZerionPortfolioApi } from '@/modules/portfolio/datasources/zerion-portfolio-api.service';
import type { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';

describe('ZerionPortfolioApi', () => {
  let service: ZerionPortfolioApi;
  let fakeConfigurationService: FakeConfigurationService;

  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });
  const supportedFiatCodes = ['USD', 'EUR'];

  const mockNetworkService = vi.mocked({
    get: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
    delete: vi.fn(),
  } as MockedObject<INetworkService>);

  const mockHttpErrorFactory = vi.mocked({
    from: vi.fn(),
  } as MockedObject<HttpErrorFactory>);

  const mockLoggingService = vi.mocked({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as MockedObject<ILoggingService>);

  const mockCacheService = vi.mocked({
    hGet: vi.fn(),
    hSet: vi.fn(),
    deleteByKey: vi.fn(),
  } as MockedObject<ICacheService>);

  const mockChainMappingService = vi.mocked({
    getNetworkFromChainId: vi.fn(),
    getChainIdFromNetwork: vi.fn(),
  } as MockedObject<ZerionChainMappingService>);

  beforeEach(() => {
    vi.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.zerion.portfolioApiKey',
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
    it.each([
      true,
      false,
    ])('should log portfolio request failures with trusted=%s', async (trusted) => {
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
    });
  });
});
