// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { ILoggingService } from '@/logging/logging.interface';
import { RhinestoneApi } from '@/modules/relay/datasources/rhinestone-api.service';
import { rawify } from '@/validation/entities/raw.entity';

const mockNetworkService = vi.mocked({
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<INetworkService>);

const mockLoggingService = vi.mocked({
  debug: vi.fn(),
  error: vi.fn(),
} as MockedObject<ILoggingService>);

describe('RhinestoneApi', () => {
  let target: RhinestoneApi;
  let fakeConfigurationService: FakeConfigurationService;
  let fakeCacheService: FakeCacheService;
  let baseUri: string;
  let apiKey: string;
  let ttlSeconds: number;
  let httpErrorFactory: HttpErrorFactory;

  beforeEach(() => {
    vi.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    fakeCacheService = new FakeCacheService();
    baseUri = faker.internet.url({ appendSlash: false });
    apiKey = faker.string.hexadecimal({ length: 32 });
    ttlSeconds = faker.number.int();
    fakeConfigurationService.set('relay.baseUri', baseUri);
    fakeConfigurationService.set('relay.apiKey', apiKey);
    fakeConfigurationService.set('relay.ttlSeconds', ttlSeconds);

    target = new RhinestoneApi(
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
      fakeCacheService,
      mockLoggingService,
    );
  });

  it('should error if baseUri is not defined', () => {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('relay.apiKey', apiKey);

    expect(
      () =>
        new RhinestoneApi(
          mockNetworkService,
          fakeConfigurationService,
          httpErrorFactory,
          fakeCacheService,
          mockLoggingService,
        ),
    ).toThrow();
  });

  it('should error if apiKey is not defined', () => {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('relay.baseUri', baseUri);

    expect(
      () =>
        new RhinestoneApi(
          mockNetworkService,
          fakeConfigurationService,
          httpErrorFactory,
          fakeCacheService,
          mockLoggingService,
        ),
    ).toThrow();
  });

  describe('relay', () => {
    it('should submit a relay with safeTxHash and return the taskId', async () => {
      const chainId = faker.string.numeric();
      const to = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const safeTxHash = faker.string.hexadecimal({ length: 64 }) as Hex;
      const taskId = faker.string.uuid();
      mockNetworkService.post.mockResolvedValue({
        data: rawify({ taskId }),
        status: 201,
      });

      const actual = await target.relay({ chainId, to, data, safeTxHash });

      expect(actual).toStrictEqual({ taskId });
      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/safe-transactions`,
        data: { chainId: Number(chainId), to, data, safeTxHash },
        networkRequest: { headers: { 'x-api-key': apiKey } },
      });
    });

    it('should submit a relay without safeTxHash (multiSend / deployments)', async () => {
      const chainId = faker.string.numeric();
      const to = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const taskId = faker.string.uuid();
      mockNetworkService.post.mockResolvedValue({
        data: rawify({ taskId }),
        status: 201,
      });

      const actual = await target.relay({ chainId, to, data });

      expect(actual).toStrictEqual({ taskId });
      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/safe-transactions`,
        data: { chainId: Number(chainId), to, data, safeTxHash: undefined },
        networkRequest: { headers: { 'x-api-key': apiKey } },
      });
    });

    it('should forward errors from the relay provider', async () => {
      const chainId = faker.string.numeric();
      const to = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const error = new NetworkResponseError(
        new URL(`${baseUri}/safe-transactions`),
        { status: 400 } as Response,
      );
      mockNetworkService.post.mockRejectedValue(error);

      await expect(target.relay({ chainId, to, data })).rejects.toThrow(
        DataSourceError,
      );
      expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTaskStatus', () => {
    it('should return the task status with a receipt when a transactionHash is present', async () => {
      const chainId = faker.string.numeric();
      const taskId = faker.string.uuid();
      const transactionHash = faker.string.hexadecimal({ length: 64 }) as Hex;
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ taskId, status: 200, transactionHash }),
        status: 200,
      });

      const actual = await target.getTaskStatus({ chainId, taskId });

      expect(actual).toStrictEqual({
        chainId,
        id: taskId,
        status: 200,
        receipt: { transactionHash },
      });
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/safe-transactions/${taskId}/status`,
        networkRequest: { headers: { 'x-api-key': apiKey } },
      });
    });

    it('should return the task status without a receipt when no transactionHash', async () => {
      const chainId = faker.string.numeric();
      const taskId = faker.string.uuid();
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ taskId, status: 100 }),
        status: 200,
      });

      const actual = await target.getTaskStatus({ chainId, taskId });

      expect(actual).toStrictEqual({
        chainId,
        id: taskId,
        status: 100,
        receipt: undefined,
      });
    });

    it('should forward errors from the relay provider', async () => {
      const chainId = faker.string.numeric();
      const taskId = faker.string.uuid();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/safe-transactions/${taskId}/status`),
        { status: 404 } as Response,
      );
      mockNetworkService.get.mockRejectedValue(error);

      await expect(target.getTaskStatus({ chainId, taskId })).rejects.toThrow(
        DataSourceError,
      );
      expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('relay count', () => {
    it('should return 0 when no count is cached', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());

      await expect(target.getRelayCount({ chainId, address })).resolves.toBe(0);
    });

    it('should set and get the relay count', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const count = faker.number.int({ min: 1, max: 5 });

      await target.setRelayCount({ chainId, address, count, ttlSeconds });

      await expect(target.getRelayCount({ chainId, address })).resolves.toBe(
        count,
      );
      const cacheDir = CacheRouter.getRelayCacheDir({ chainId, address });
      await expect(fakeCacheService.hGet(cacheDir)).resolves.toBe(
        count.toString(),
      );
    });
  });
});
