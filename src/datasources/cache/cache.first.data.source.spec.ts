import { faker } from '@faker-js/faker';
import { ILoggingService } from '../../logging/logging.interface';
import { NetworkResponseError } from '../network/entities/network.error.entity';
import { CacheFirstDataSource } from './cache.first.data.source';
import { ICacheService } from './cache.service.interface';
import { CacheDir } from './entities/cache-dir.entity';
import { FakeCacheService } from './__tests__/fake.cache.service';
import { fakeJson } from '../../__tests__/faker';
import { INetworkService } from '../network/network.service.interface';

const mockLoggingService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as ILoggingService;

const networkService = {
  get: jest.fn(),
} as unknown as INetworkService;

const mockNetworkService = jest.mocked(networkService);

describe('CacheFirstDataSource', () => {
  let cacheFirstDataSource: CacheFirstDataSource;
  let fakeCacheService: FakeCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    fakeCacheService = new FakeCacheService();
    cacheFirstDataSource = new CacheFirstDataSource(
      fakeCacheService,
      mockNetworkService,
      mockLoggingService,
    );
  });

  it('should return the data returned by the underlying network interface', async () => {
    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const data = JSON.parse(fakeJson());
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.resolve({ data });
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    const actual = await cacheFirstDataSource.get(
      cacheDir,
      targetUrl,
      notFoundExpireTimeSeconds,
    );

    expect(actual).toEqual(data);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
  });

  it('should return the cached data without calling the underlying network interface', async () => {
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const rawJson = fakeJson();
    fakeCacheService.set(cacheDir, rawJson);
    mockNetworkService.get.mockImplementation((url) =>
      Promise.reject(`Unexpected request to ${url}`),
    );

    const actual = await cacheFirstDataSource.get(
      cacheDir,
      faker.internet.url({ appendSlash: false }),
      notFoundExpireTimeSeconds,
    );

    expect(actual).toEqual(JSON.parse(rawJson));
    expect(mockNetworkService.get).toHaveBeenCalledTimes(0);
  });

  it('should cache 404 errors coming from the network', async () => {
    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const expectedError = new NetworkResponseError(404);
    const notFoundExpireTimeSeconds = faker.number.int();
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.reject(expectedError);
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await expect(
      cacheFirstDataSource.get(cacheDir, targetUrl, notFoundExpireTimeSeconds),
    ).rejects.toThrowError(expectedError);

    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(fakeCacheService.keyCount()).toBe(1);
  });

  it('should return a 404 cached error without a second call to the underlying network interface', async () => {
    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const expectedError = new NetworkResponseError(404);
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.reject(expectedError);
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await expect(
      cacheFirstDataSource.get(cacheDir, targetUrl, notFoundExpireTimeSeconds),
    ).rejects.toThrowError(expectedError);

    await expect(
      cacheFirstDataSource.get(cacheDir, targetUrl, notFoundExpireTimeSeconds),
    ).rejects.toThrowError(expectedError);

    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(fakeCacheService.keyCount()).toBe(1);
  });

  it('should cache not found errors with the default TTL', async () => {
    const mockCache = jest.mocked({
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as unknown as ICacheService);

    cacheFirstDataSource = new CacheFirstDataSource(
      mockCache,
      mockNetworkService,
      mockLoggingService,
    );

    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const notFoundExpireTimeSeconds = faker.number.int();
    const expectedError = new NetworkResponseError(404);
    mockCache.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.reject(expectedError);
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await expect(
      cacheFirstDataSource.get(cacheDir, targetUrl, notFoundExpireTimeSeconds),
    ).rejects.toThrowError(expectedError);

    expect(mockCache.set).toHaveBeenCalledWith(
      cacheDir,
      expect.anything(),
      notFoundExpireTimeSeconds,
    );
  });

  it('should cache not found errors with a specific TTL', async () => {
    const mockCache = jest.mocked({
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as unknown as ICacheService);

    cacheFirstDataSource = new CacheFirstDataSource(
      mockCache,
      mockNetworkService,
      mockLoggingService,
    );

    const targetUrl = faker.internet.url({ appendSlash: false });
    const cacheDir = new CacheDir(faker.word.sample(), faker.word.sample());
    const expectedError = new NetworkResponseError(404);
    const notFoundExpireTimeSeconds = faker.number.int();
    mockCache.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockImplementation((url) => {
      switch (url) {
        case targetUrl:
          return Promise.reject(expectedError);
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });

    await expect(
      cacheFirstDataSource.get(
        cacheDir,
        targetUrl,
        notFoundExpireTimeSeconds,
        undefined,
        faker.number.int(),
      ),
    ).rejects.toThrowError(expectedError);

    expect(mockCache.set).toHaveBeenCalledWith(
      cacheDir,
      expect.anything(),
      notFoundExpireTimeSeconds,
    );
  });
});
