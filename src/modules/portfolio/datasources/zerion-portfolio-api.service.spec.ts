import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { ILoggingService } from '@/logging/logging.interface';
import { ZerionPortfolioApi } from '@/modules/portfolio/datasources/zerion-portfolio-api.service';
import type { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const mockNetworkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockHttpErrorFactory = jest.mocked({
  from: jest.fn(),
} as jest.MockedObjectDeep<HttpErrorFactory>);

const mockLoggingService = jest.mocked({
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockCacheService = jest.mocked(
  {} as jest.MockedObjectDeep<ICacheService>,
);

const mockZerionChainMappingService = jest.mocked({
  getChainIdFromNetwork: jest.fn(),
} as jest.MockedObjectDeep<ZerionChainMappingService>);

describe('ZerionPortfolioApi', () => {
  let service: ZerionPortfolioApi;
  let fakeConfigurationService: FakeConfigurationService;
  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });
  const supportedFiatCodes = ['USD', 'EUR'];

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
      fakeConfigurationService,
      mockHttpErrorFactory,
      mockLoggingService,
      mockCacheService,
      mockZerionChainMappingService,
    );
  });

  describe('getPortfolio', () => {
    it('logs upstream portfolio errors with request context', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      const chainIds = ['1', '100'];
      const url = new URL(`${zerionBaseUri}/v1/wallets/${address}/positions`);
      const error = new NetworkResponseError(
        url,
        {
          status: 401,
          statusText: 'Unauthorized',
        } as Response,
        { message: 'Invalid API key' },
      );
      const mappedError = new DataSourceError('Invalid API key', 401);
      mockNetworkService.get.mockRejectedValueOnce(error);
      mockHttpErrorFactory.from.mockReturnValueOnce(mappedError);

      await expect(
        service.getPortfolio({
          address,
          fiatCode,
          chainIds,
          trusted: false,
          isTestnet: false,
        }),
      ).rejects.toThrow(mappedError);

      expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.error).toHaveBeenCalledWith({
        type: LogType.PortfolioError,
        provider: 'zerion',
        endpoint: 'portfolio',
        address,
        chain_ids: chainIds,
        fiat_code: fiatCode,
        trusted: false,
        is_testnet: false,
        sync: undefined,
        error_message: 'Invalid API key',
        protocol: url.protocol,
        target_host: url.host,
        path: url.pathname,
        request_status: 401,
        detail: 'Unauthorized',
        source_error_message: 'Invalid API key',
      });
    });
  });
});
