// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { GelatoApi } from '@/modules/relay/datasources/gelato-api.service';
import { faker } from '@faker-js/faker';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { rawify } from '@/validation/entities/raw.entity';
import type { ILoggingService } from '@/logging/logging.interface';

const mockNetworkService = jest.mocked({
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockLoggingService = {
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('GelatoApi', () => {
  let target: GelatoApi;
  let fakeConfigurationService: FakeConfigurationService;
  let fakeCacheService: FakeCacheService;
  let baseUri: string;
  let ttlSeconds: number;
  let httpErrorFactory: HttpErrorFactory;

  beforeEach(() => {
    jest.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    fakeCacheService = new FakeCacheService();
    baseUri = faker.internet.url({ appendSlash: false });
    ttlSeconds = faker.number.int();
    fakeConfigurationService.set('relay.baseUri', baseUri);
    fakeConfigurationService.set('relay.ttlSeconds', ttlSeconds);

    target = new GelatoApi(
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
      fakeCacheService,
      mockLoggingService,
    );
  });

  it('should error if baseUri is not defined', () => {
    const fakeConfigurationService = new FakeConfigurationService();
    const fakeCacheService = new FakeCacheService();
    const httpErrorFactory = new HttpErrorFactory();

    expect(
      () =>
        new GelatoApi(
          mockNetworkService,
          fakeConfigurationService,
          httpErrorFactory,
          fakeCacheService,
          mockLoggingService,
        ),
    ).toThrow();
  });

  describe('relay', () => {
    it('should relay the payload', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const apiKey = faker.string.sample();
      const taskId = faker.string.uuid();
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({
          jsonrpc: '2.0',
          result: taskId,
          id: 1,
        }),
      });

      const result = await target.relay({
        chainId,
        to: address,
        data,
      });

      expect(result).toEqual({ taskId });
      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/rpc`,
        data: {
          id: 1,
          jsonrpc: '2.0',
          method: 'relayer_sendTransaction',
          params: {
            chainId,
            to: address,
            data,
            payment: { type: 'sponsored' },
          },
        },
        networkRequest: {
          headers: {
            'X-API-Key': apiKey,
          },
        },
      });
    });

    it('should throw if there is no API key preset', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
        }),
      ).rejects.toThrow();
    });

    it('should forward error', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const apiKey = faker.string.sample();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/rpc`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));
    });
  });

  describe('getTaskStatus', () => {
    it('should return the task status', async () => {
      const chainId = faker.string.numeric();
      const taskId = faker.string.hexadecimal({ length: 64 });
      const apiKey = faker.string.sample();
      const taskStatus = {
        chainId,
        createdAt: faker.number.int(),
        id: taskId,
        status: 200,
        receipt: {
          blockHash: faker.string.hexadecimal({ length: 64 }),
          blockNumber: faker.string.numeric(),
          gasUsed: faker.string.numeric(),
          transactionHash: faker.string.hexadecimal({ length: 64 }),
        },
      };
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({
          jsonrpc: '2.0',
          result: taskStatus,
          id: 1,
        }),
      });

      const result = await target.getTaskStatus({ chainId, taskId });

      expect(result).toEqual(taskStatus);
      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/rpc`,
        data: {
          id: 1,
          jsonrpc: '2.0',
          method: 'relayer_getStatus',
          params: {
            id: taskId,
            logs: false,
          },
        },
        networkRequest: {
          headers: {
            'X-API-Key': apiKey,
          },
        },
      });
    });

    it('should return the task status without receipt', async () => {
      const chainId = faker.string.numeric();
      const taskId = faker.string.hexadecimal({ length: 64 });
      const apiKey = faker.string.sample();
      const taskStatus = {
        chainId,
        createdAt: faker.number.int(),
        id: taskId,
        status: 100,
      };
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({
          jsonrpc: '2.0',
          result: taskStatus,
          id: 1,
        }),
      });

      const result = await target.getTaskStatus({ chainId, taskId });

      expect(result).toEqual(taskStatus);
    });

    it('should throw if there is no API key preset', async () => {
      const chainId = faker.string.numeric();
      const taskId = faker.string.hexadecimal({ length: 64 });

      await expect(target.getTaskStatus({ chainId, taskId })).rejects.toThrow();
    });

    it('should forward error', async () => {
      const chainId = faker.string.numeric();
      const taskId = faker.string.hexadecimal({ length: 64 });
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const apiKey = faker.string.sample();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/rpc`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(target.getTaskStatus({ chainId, taskId })).rejects.toThrow(
        new DataSourceError('Unexpected error', status),
      );
    });
  });

  describe('getRelayCount', () => {
    it('should return the count', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const count = faker.number.int({ min: 1 });
      await fakeCacheService.hSet(
        new CacheDir(`${chainId}_relay_${address}`, ''),
        count.toString(),
        ttlSeconds,
      );

      const result = await target.getRelayCount({
        chainId,
        address,
      });

      expect(result).toBe(count);
    });

    it('should return 0 if the count is not cached', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());

      const result = await target.getRelayCount({
        chainId,
        address,
      });

      expect(result).toBe(0);
    });
  });

  describe('setRelayCount', () => {
    it('should cache the count', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const count = faker.number.int({ min: 1 });

      await target.setRelayCount({
        chainId,
        address,
        count,
        ttlSeconds: faker.number.int(),
      });

      const result = await fakeCacheService.hGet(
        new CacheDir(`${chainId}_relay_${address}`, ''),
      );
      expect(result).toBe(count.toString());
    });
  });
});
