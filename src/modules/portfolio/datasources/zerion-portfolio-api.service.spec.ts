// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { ILoggingService } from '@/logging/logging.interface';
import { ZerionPortfolioApi } from '@/modules/portfolio/datasources/zerion-portfolio-api.service';
import type { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('ZerionPortfolioApi', () => {
  let service: ZerionPortfolioApi;
  let fakeConfigurationService: FakeConfigurationService;

  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });
  const supportedFiatCodes = ['USD', 'EUR'];

  const mockNetworkService = jest.mocked({
    get: jest.fn(),
    post: jest.fn(),
    postForm: jest.fn(),
    delete: jest.fn(),
  } as jest.MockedObjectDeep<INetworkService>);

  const mockHttpErrorFactory = jest.mocked({
    from: jest.fn(),
  } as jest.MockedObjectDeep<HttpErrorFactory>);

  const mockLoggingService = jest.mocked({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as jest.MockedObjectDeep<ILoggingService>);

  const mockCacheService = jest.mocked({
    hGet: jest.fn(),
    hSet: jest.fn(),
    deleteByKey: jest.fn(),
  } as jest.MockedObjectDeep<ICacheService>);

  const mockChainMappingService = jest.mocked({
    getNetworkFromChainId: jest.fn(),
    getChainIdFromNetwork: jest.fn(),
  } as jest.MockedObjectDeep<ZerionChainMappingService>);

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.zerion.apiKey',
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
