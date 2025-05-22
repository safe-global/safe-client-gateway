import { faker } from '@faker-js/faker';
import { LifiBridgeApi } from '@/datasources/bridge-api/lifi-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { bridgeQuoteBuilder } from '@/domain/bridge/entities/__tests__/bridge-quote.builder';
import { bridgeStatusBuilder } from '@/domain/bridge/entities/__tests__/bridge-status.builder';
import { BridgeNames } from '@/domain/bridge/entities/bridge-name.entity';
import { rawify } from '@/validation/entities/raw.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { getAddress } from 'viem';
import { bridgeChainPageBuilder } from '@/domain/bridge/entities/__tests__/bridge-chain.builder';

const mockNetworkService = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

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
      httpErrorFactory,
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

  describe('getQuote', () => {
    it('should return a quote', async () => {
      const bridgeQuote = bridgeQuoteBuilder().build();
      const args = {
        toChain: faker.string.numeric(),
        fromToken: getAddress(faker.finance.ethereumAddress()),
        toToken: getAddress(faker.finance.ethereumAddress()),
        fromAddress: getAddress(faker.finance.ethereumAddress()),
        fromAmount: faker.string.numeric(),
      };
      mockNetworkService.post.mockResolvedValueOnce({
        data: rawify(bridgeQuote),
        status: 200,
      });

      const actual = await target.getQuote(args);

      expect(actual).toBe(bridgeQuote);
      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUrl}/v1/quote`,
        data: {
          fromChain: chainId,
          ...args,
        },
        networkRequest: {
          headers: {
            'x-lifi-api-key': apiKey,
          },
        },
      });
    });

    it('should forward errors', async () => {
      const args = {
        toChain: faker.string.numeric(),
        fromToken: getAddress(faker.finance.ethereumAddress()),
        toToken: getAddress(faker.finance.ethereumAddress()),
        fromAddress: getAddress(faker.finance.ethereumAddress()),
        fromAmount: faker.string.numeric(),
      };
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
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(target.getQuote(args)).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
    });
  });

  it.todo('getRoutes');
});
