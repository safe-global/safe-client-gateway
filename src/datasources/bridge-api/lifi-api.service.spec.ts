import { faker } from '@faker-js/faker';
import { LifiBridgeApi } from '@/datasources/bridge-api/lifi-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { bridgeStatusBuilder } from '@/domain/bridge/entities/__tests__/bridge-status.builder';
import { BridgeNames } from '@/domain/bridge/entities/bridge-name.entity';
import { rawify } from '@/validation/entities/raw.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { bridgeChainPageBuilder } from '@/domain/bridge/entities/__tests__/bridge-chain.builder';
import { type CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { type IConfigurationService } from '@/config/configuration.service.interface';

const mockNetworkService = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

const mockConfigurationService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('LifiBridgeApi', () => {
  let target: LifiBridgeApi;

  let chainId: string;
  let baseUrl: string;
  let apiKey: string;
  let httpErrorFactory: HttpErrorFactory;

  beforeEach(() => {
    jest.resetAllMocks();

    chainId = faker.string.numeric();
    baseUrl = faker.internet.url({ appendSlash: false });
    apiKey = faker.string.uuid();
    httpErrorFactory = new HttpErrorFactory();

    target = new LifiBridgeApi(
      chainId,
      baseUrl,
      apiKey,
      mockNetworkService,
      mockCacheFirstDataSource,
      httpErrorFactory,
      mockConfigurationService,
    );
  });

  describe('getChains', () => {
    it('should return the chains', async () => {
      const bridgeChainPage = bridgeChainPageBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(bridgeChainPage),
        status: 200,
      });

      const actual = await target.getChains();

      expect(actual).toBe(bridgeChainPage);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUrl}/v1/chains`,
        networkRequest: {
          params: {
            chainTypes: 'EVM',
          },
          headers: {
            'x-lifi-api-key': apiKey,
          },
        },
      });
    });

    it('should forward errors', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUrl}/v1/chains`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(target.getChains()).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStatus', () => {
    it('should return the status', async () => {
      const bridgeStatus = bridgeStatusBuilder().build();
      const txHash = faker.string.hexadecimal({ length: 64 }) as `0x${string}`;
      const bridge = faker.helpers.arrayElement(BridgeNames);
      const toChain = faker.string.numeric();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(bridgeStatus),
        status: 200,
      });

      const actual = await target.getStatus({
        txHash,
        bridge,
        toChain,
      });

      expect(actual).toBe(bridgeStatus);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUrl}/v1/status`,
        networkRequest: {
          params: {
            txHash,
            fromChain: chainId,
            toChain,
            bridge,
          },
          headers: {
            'x-lifi-api-key': apiKey,
          },
        },
      });
    });

    it('should forward errors', async () => {
      const txHash = faker.string.hexadecimal({ length: 64 }) as `0x${string}`;
      const bridge = faker.helpers.arrayElement(BridgeNames);
      const toChain = faker.string.numeric();
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUrl}/v1/status`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        target.getStatus({
          txHash,
          bridge,
          toChain,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });
});
