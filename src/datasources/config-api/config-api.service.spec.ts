import { ConfigApi } from './config-api.service';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { faker } from '@faker-js/faker';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { CacheDir } from '../cache/entities/cache-dir.entity';
import { ICacheService } from '../cache/cache.service.interface';

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;
const mockDataSource = jest.mocked(dataSource);

const cacheService = {
  deleteByKey: jest.fn(),
  deleteByKeyPattern: jest.fn(),
} as unknown as ICacheService;
const mockCacheService = jest.mocked(cacheService);

const httpErrorFactory = {
  from: jest.fn(),
} as unknown as HttpErrorFactory;
const mockHttpErrorFactory = jest.mocked(httpErrorFactory);

describe('ConfigApi', () => {
  const baseUri = faker.internet.url({ appendSlash: false });
  const expirationTimeInSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();
  let fakeConfigurationService;
  let service: ConfigApi;

  beforeAll(async () => {
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('safeConfig.baseUri', baseUri);
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      expirationTimeInSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpirationTimeInSeconds,
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new ConfigApi(
      dataSource,
      mockCacheService,
      fakeConfigurationService,
      mockHttpErrorFactory,
    );
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();

    await expect(
      () =>
        new ConfigApi(
          dataSource,
          mockCacheService,
          fakeConfigurationService,
          mockHttpErrorFactory,
        ),
    ).toThrow();
  });

  it('should return the chains retrieved', async () => {
    const data = [chainBuilder().build(), chainBuilder().build()];
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getChains({});

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      new CacheDir('chains', 'undefined_undefined'),
      `${baseUri}/api/v1/chains`,
      notFoundExpirationTimeInSeconds,
      { params: { limit: undefined, offset: undefined } },
      expirationTimeInSeconds,
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should return the chain retrieved', async () => {
    const data = chainBuilder().build();
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getChain(data.chainId);

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      new CacheDir(`${data.chainId}_chain`, ''),
      `${baseUri}/api/v1/chains/${data.chainId}`,
      notFoundExpirationTimeInSeconds,
      undefined,
      expirationTimeInSeconds,
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should return the safe apps retrieved by chainId', async () => {
    const chainId = faker.string.numeric();
    const data = [safeAppBuilder().build(), safeAppBuilder().build()];
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getSafeApps({ chainId });

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      new CacheDir(`${chainId}_safe_apps`, 'undefined_undefined'),
      `${baseUri}/api/v1/safe-apps/`,
      notFoundExpirationTimeInSeconds,
      { params: { chainId, clientUrl: undefined, url: undefined } },
      expirationTimeInSeconds,
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should return the safe apps retrieved by chainId and url', async () => {
    const chainId = faker.string.numeric();
    const url = faker.internet.url({ appendSlash: false });
    const data = [safeAppBuilder().build(), safeAppBuilder().build()];
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getSafeApps({ chainId, url });

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      new CacheDir(`${chainId}_safe_apps`, `undefined_${url}`),
      `${baseUri}/api/v1/safe-apps/`,
      notFoundExpirationTimeInSeconds,
      { params: { chainId, clientUrl: undefined, url } },
      expirationTimeInSeconds,
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should return the safe apps retrieved by chainId and clientUrl', async () => {
    const chainId = faker.string.numeric();
    const clientUrl = faker.internet.url({ appendSlash: false });
    const data = [safeAppBuilder().build(), safeAppBuilder().build()];
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getSafeApps({ chainId, clientUrl });

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      new CacheDir(`${chainId}_safe_apps`, `${clientUrl}_undefined`),
      `${baseUri}/api/v1/safe-apps/`,
      notFoundExpirationTimeInSeconds,
      { params: { chainId, clientUrl, url: undefined } },
      expirationTimeInSeconds,
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should forward error', async () => {
    const expected = new DataSourceError('some unexpected error');
    mockHttpErrorFactory.from.mockReturnValue(expected);
    mockDataSource.get.mockRejectedValueOnce(new Error('Some error'));

    await expect(service.getChains({})).rejects.toThrowError(expected);

    expect(mockDataSource.get).toHaveBeenCalledTimes(1);
    expect(mockHttpErrorFactory.from).toBeCalledTimes(1);
  });

  it('clear chains should trigger delete on cache service', async () => {
    await service.clearChains();

    expect(mockCacheService.deleteByKey).toBeCalledWith('chains');
    expect(mockCacheService.deleteByKeyPattern).toBeCalledWith('*_chain');
    expect(mockCacheService.deleteByKey).toBeCalledTimes(1);
    expect(mockCacheService.deleteByKeyPattern).toBeCalledTimes(1);
  });

  it('clear safe apps should trigger delete on cache service', async () => {
    await service.clearSafeApps();

    expect(mockCacheService.deleteByKeyPattern).toBeCalledWith('*_safe_apps');
    expect(mockCacheService.deleteByKeyPattern).toBeCalledTimes(1);
    expect(mockCacheService.deleteByKey).toBeCalledTimes(0);
  });
});
