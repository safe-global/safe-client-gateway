// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { fakeJson } from '@/__tests__/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService: MockedObject<ILoggingService> = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const networkService = {
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<INetworkService>;

const mockNetworkService = vi.mocked(networkService);

describe('CacheFirstDataSource', () => {
  let cacheFirstDataSource: CacheFirstDataSource;
  let fakeCacheService: FakeCacheService;
  let fakeConfigurationService: FakeConfigurationService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    fakeCacheService = new FakeCacheService();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('features.debugLogs', true);
    fakeConfigurationService.set('features.configHooksDebugLogs', false);
    cacheFirstDataSource = new CacheFirstDataSource(
      fakeCacheService,
      mockNetworkService,
      mockLoggingService,
      fakeConfigurationService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get', () => {
    it('should return the data returned by the underlying network interface and cache it', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const data = JSON.parse(fakeJson());
      mockNetworkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.resolve({ data, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const actual = await cacheFirstDataSource.get({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds: faker.number.int({ min: 1 }),
      });

      expect(actual).toEqual(data);
      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(1); // only data is cached (as no invalidation happened yet at this point in time)
      await expect(fakeCacheService.hGet(cacheDir)).resolves.toEqual(
        JSON.stringify(data),
      );
    });

    it('should return the network data and it should cache it if the last invalidation happened before the request was initiated', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const data = JSON.parse(fakeJson());
      const invalidationTimeMs = Date.now(); // invalidation happens at this point in time
      await fakeCacheService.hSet(
        new CacheDir(`invalidationTimeMs:${cacheDir.key}`, ''),
        invalidationTimeMs.toString(),
        faker.number.int({ min: 1 }),
      );
      mockNetworkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.resolve({ data, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      vi.advanceTimersByTime(1); // the request is sent 1 ms after invalidation happened
      const actual = await cacheFirstDataSource.get({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds: faker.number.int({ min: 1 }),
      });

      expect(actual).toEqual(data);
      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(2); // both data and invalidation timestamp are cached
      expect(await fakeCacheService.hGet(cacheDir)).toEqual(
        JSON.stringify(data),
      ); // item is cached
    });

    it('should return the network data but it should not cache it if the last invalidation happened after the request was initiated', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const data = JSON.parse(fakeJson());
      const invalidationTimeMs = Date.now() + 1; // invalidation happens 1 ms after this point in time
      await fakeCacheService.hSet(
        new CacheDir(`invalidationTimeMs:${cacheDir.key}`, ''),
        invalidationTimeMs.toString(),
        faker.number.int({ min: 1 }),
      );
      mockNetworkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.resolve({ data, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      // the request is sent at this point in time (1 ms before invalidation happened)
      const actual = await cacheFirstDataSource.get({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds: faker.number.int({ min: 1 }),
      });

      expect(actual).toEqual(data);
      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(1); // only invalidation timestamp is cached
      await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull(); // item is not cached
    });

    it('should return the cached data without calling the underlying network interface', async () => {
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const rawJson = fakeJson();
      await fakeCacheService.hSet(
        cacheDir,
        rawJson,
        faker.number.int({ min: 1 }),
      );
      mockNetworkService.get.mockImplementation(({ url }) =>
        Promise.reject(`Unexpected request to ${url}`),
      );

      const actual = await cacheFirstDataSource.get({
        cacheDir,
        url: faker.internet.url({ appendSlash: false }),
        notFoundExpireTimeSeconds,
      });

      expect(actual).toEqual(JSON.parse(rawJson));
      expect(mockNetworkService.get).toHaveBeenCalledTimes(0);
    });

    it('should cache 404 errors coming from the network', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const expectedError = new NetworkResponseError(new URL(targetUrl), {
        status: 404,
      } as Response);
      const notFoundExpireTimeSeconds = faker.number.int();
      mockNetworkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.reject(expectedError);
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await expect(
        cacheFirstDataSource.get({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
          expireTimeSeconds: faker.number.int({ min: 1 }),
        }),
      ).rejects.toThrow(NetworkResponseError);

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(1);
    });

    it('should return a 404 cached error without a second call to the underlying network interface', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const expectedError = new NetworkResponseError(new URL(targetUrl), {
        status: 404,
      } as Response);
      mockNetworkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.reject(expectedError);
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await expect(
        cacheFirstDataSource.get({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
        }),
      ).rejects.toThrow(NetworkResponseError);

      await expect(
        cacheFirstDataSource.get({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
        }),
      ).rejects.toThrow(NetworkResponseError);

      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(1);
    });

    it('should cache not found errors with the default TTL', async () => {
      const mockCache = vi.mocked({
        hGet: vi.fn(),
        hSet: vi.fn(),
      } as MockedObject<ICacheService>);

      cacheFirstDataSource = new CacheFirstDataSource(
        mockCache,
        mockNetworkService,
        mockLoggingService,
        fakeConfigurationService,
      );

      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const expectedError = new NetworkResponseError(new URL(targetUrl), {
        status: 404,
      } as Response);
      mockCache.hGet.mockResolvedValue(null);
      mockNetworkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.reject(expectedError);
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await expect(
        cacheFirstDataSource.get({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
        }),
      ).rejects.toThrow(NetworkResponseError);

      expect(mockCache.hSet).toHaveBeenCalledWith(
        cacheDir,
        expect.anything(),
        notFoundExpireTimeSeconds,
      );
    });

    it('should cache not found errors with a specific TTL', async () => {
      const mockCache = vi.mocked({
        hGet: vi.fn(),
        hSet: vi.fn(),
      } as MockedObject<ICacheService>);

      cacheFirstDataSource = new CacheFirstDataSource(
        mockCache,
        mockNetworkService,
        mockLoggingService,
        fakeConfigurationService,
      );

      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const expectedError = new NetworkResponseError(new URL(targetUrl), {
        status: 404,
      } as Response);
      const notFoundExpireTimeSeconds = faker.number.int();
      mockCache.hGet.mockResolvedValue(null);
      mockNetworkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.reject(expectedError);
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await expect(
        cacheFirstDataSource.get({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
          expireTimeSeconds: faker.number.int({ min: 1 }),
        }),
      ).rejects.toThrow(NetworkResponseError);

      expect(mockCache.hSet).toHaveBeenCalledWith(
        cacheDir,
        expect.anything(),
        notFoundExpireTimeSeconds,
      );
    });
  });

  describe('post', () => {
    it('should return the data returned by the underlying network interface and cache it', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const res = JSON.parse(fakeJson());
      const data = JSON.parse(fakeJson());
      mockNetworkService.post.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.resolve({ data: res, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      const actual = await cacheFirstDataSource.post({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds: faker.number.int({ min: 1 }),
        data,
      });

      expect(actual).toEqual(res);
      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(1); // only data is cached (as no invalidation happened yet at this point in time)
      await expect(fakeCacheService.hGet(cacheDir)).resolves.toEqual(
        JSON.stringify(res),
      );
    });

    it('should return the network data and it should cache it if the last invalidation happened before the request was initiated', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const res = JSON.parse(fakeJson());
      const data = JSON.parse(fakeJson());
      const invalidationTimeMs = Date.now(); // invalidation happens at this point in time
      await fakeCacheService.hSet(
        new CacheDir(`invalidationTimeMs:${cacheDir.key}`, ''),
        invalidationTimeMs.toString(),
        faker.number.int({ min: 1 }),
      );
      mockNetworkService.post.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.resolve({ data: res, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      vi.advanceTimersByTime(1); // the request is sent 1 ms after invalidation happened
      const actual = await cacheFirstDataSource.post({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds: faker.number.int({ min: 1 }),
        data,
      });

      expect(actual).toEqual(res);
      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(2); // both data and invalidation timestamp are cached
      expect(await fakeCacheService.hGet(cacheDir)).toEqual(
        JSON.stringify(res),
      ); // item is cached
    });

    it('should return the network data but it should not cache it if the last invalidation happened after the request was initiated', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const res = JSON.parse(fakeJson());
      const data = JSON.parse(fakeJson());
      const invalidationTimeMs = Date.now() + 1; // invalidation happens 1 ms after this point in time
      await fakeCacheService.hSet(
        new CacheDir(`invalidationTimeMs:${cacheDir.key}`, ''),
        invalidationTimeMs.toString(),
        faker.number.int({ min: 1 }),
      );
      mockNetworkService.post.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.resolve({ data: res, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      // the request is sent at this point in time (1 ms before invalidation happened)
      const actual = await cacheFirstDataSource.post({
        cacheDir,
        url: targetUrl,
        notFoundExpireTimeSeconds,
        expireTimeSeconds: faker.number.int({ min: 1 }),
        data,
      });

      expect(actual).toEqual(res);
      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(1); // only invalidation timestamp is cached
      await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull(); // item is not cached
    });

    it('should return the cached data without calling the underlying network interface', async () => {
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const rawJson = fakeJson();
      const data = JSON.parse(fakeJson());
      await fakeCacheService.hSet(
        cacheDir,
        rawJson,
        faker.number.int({ min: 1 }),
      );
      mockNetworkService.post.mockImplementation(({ url }) =>
        Promise.reject(`Unexpected request to ${url}`),
      );

      const actual = await cacheFirstDataSource.post({
        cacheDir,
        url: faker.internet.url({ appendSlash: false }),
        notFoundExpireTimeSeconds,
        data,
      });

      expect(actual).toEqual(JSON.parse(rawJson));
      expect(mockNetworkService.post).toHaveBeenCalledTimes(0);
    });

    it('should cache 404 errors coming from the network', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const expectedError = new NetworkResponseError(new URL(targetUrl), {
        status: 404,
      } as Response);
      const notFoundExpireTimeSeconds = faker.number.int();
      const data = JSON.parse(fakeJson());
      mockNetworkService.post.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.reject(expectedError);
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await expect(
        cacheFirstDataSource.post({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
          expireTimeSeconds: faker.number.int({ min: 1 }),
          data,
        }),
      ).rejects.toThrow(NetworkResponseError);

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(1);
    });

    it('should return a 404 cached error without a second call to the underlying network interface', async () => {
      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const expectedError = new NetworkResponseError(new URL(targetUrl), {
        status: 404,
      } as Response);
      const data = JSON.parse(fakeJson());
      mockNetworkService.post.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.reject(expectedError);
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await expect(
        cacheFirstDataSource.post({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
          data,
        }),
      ).rejects.toThrow(NetworkResponseError);

      await expect(
        cacheFirstDataSource.post({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
          data,
        }),
      ).rejects.toThrow(NetworkResponseError);

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
      expect(fakeCacheService.keyCount()).toBe(1);
    });

    it('should cache not found errors with the default TTL', async () => {
      const mockCache = vi.mocked({
        hGet: vi.fn(),
        hSet: vi.fn(),
      } as MockedObject<ICacheService>);

      cacheFirstDataSource = new CacheFirstDataSource(
        mockCache,
        mockNetworkService,
        mockLoggingService,
        fakeConfigurationService,
      );

      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const notFoundExpireTimeSeconds = faker.number.int();
      const expectedError = new NetworkResponseError(new URL(targetUrl), {
        status: 404,
      } as Response);
      const data = JSON.parse(fakeJson());
      mockCache.hGet.mockResolvedValue(null);
      mockNetworkService.post.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.reject(expectedError);
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await expect(
        cacheFirstDataSource.post({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
          data,
        }),
      ).rejects.toThrow(NetworkResponseError);

      expect(mockCache.hSet).toHaveBeenCalledWith(
        cacheDir,
        expect.anything(),
        notFoundExpireTimeSeconds,
      );
    });

    it('should cache not found errors with a specific TTL', async () => {
      const mockCache = vi.mocked({
        hGet: vi.fn(),
        hSet: vi.fn(),
      } as MockedObject<ICacheService>);

      cacheFirstDataSource = new CacheFirstDataSource(
        mockCache,
        mockNetworkService,
        mockLoggingService,
        fakeConfigurationService,
      );

      const targetUrl = faker.internet.url({ appendSlash: false });
      const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
      const expectedError = new NetworkResponseError(new URL(targetUrl), {
        status: 404,
      } as Response);
      const notFoundExpireTimeSeconds = faker.number.int();
      const data = JSON.parse(fakeJson());
      mockCache.hGet.mockResolvedValue(null);
      mockNetworkService.post.mockImplementation(({ url }) => {
        switch (url) {
          case targetUrl:
            return Promise.reject(expectedError);
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await expect(
        cacheFirstDataSource.post({
          cacheDir,
          url: targetUrl,
          notFoundExpireTimeSeconds,
          expireTimeSeconds: faker.number.int({ min: 1 }),
          data,
        }),
      ).rejects.toThrow(NetworkResponseError);

      expect(mockCache.hSet).toHaveBeenCalledWith(
        cacheDir,
        expect.anything(),
        notFoundExpireTimeSeconds,
      );
    });
  });
});
