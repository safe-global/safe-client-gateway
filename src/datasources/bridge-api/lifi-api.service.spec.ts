import { faker } from '@faker-js/faker';
import { LifiBridgeApi } from '@/datasources/bridge-api/lifi-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { bridgeCalldataBuilder } from '@/domain/bridge/entities/__tests__/bridge-calldata.entity';
import { bridgeStatusBuilder } from '@/domain/bridge/entities/__tests__/bridge-status.builder';
import { BridgeNames } from '@/domain/bridge/entities/bridge-name.entity';
import { rawify } from '@/validation/entities/raw.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { INetworkService } from '@/datasources/network/network.service.interface';

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

  describe('getStatus', () => {
    it('should return the status', async () => {
      const bridgeStatus = bridgeStatusBuilder().build();
      const txHash = faker.string.hexadecimal({ length: 64 }) as `0x${string}`;
      const bridge = faker.helpers.arrayElement(BridgeNames);
      const toChainId = faker.string.numeric();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(bridgeStatus),
        status: 200,
      });

      const actual = await target.getStatus({
        txHash,
        bridge,
        toChainId,
      });

      expect(actual).toBe(bridgeStatus);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUrl}/v1/status`,
        networkRequest: {
          params: {
            txHash,
            fromChainId: chainId,
            toChainId,
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
      const toChainId = faker.string.numeric();
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
          toChainId,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseCalldata', () => {
    it('should parse the calldata', async () => {
      const bridgeCalldata = bridgeCalldataBuilder().build();
      const data = faker.string.hexadecimal() as `0x${string}`;
      mockNetworkService.post.mockResolvedValueOnce({
        data: rawify(bridgeCalldata),
        status: 200,
      });

      const actual = await target.parseCalldata(data);

      expect(actual).toBe(bridgeCalldata);
      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUrl}/v1/calldata/parse`,
        data: {
          chainId,
          callData: data,
        },
        networkRequest: {
          headers: {
            'x-lifi-api-key': apiKey,
          },
        },
      });
    });

    it('should forward errors', async () => {
      const data = faker.string.hexadecimal() as `0x${string}`;
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

      await expect(target.parseCalldata(data)).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
    });
  });
});
