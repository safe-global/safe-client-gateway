import { ConfigApi } from './config-api.service';
import { FakeConfigurationService } from '../../config/__tests__/fake.configuration.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { DataSourceError } from '../../domain/errors/data-source.error';
import { faker } from '@faker-js/faker';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { safeAppBuilder } from '../../domain/safe-apps/entities/__tests__/safe-app.builder';
import { CacheDir } from '../cache/entities/cache-dir.entity';

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;
const mockDataSource = jest.mocked(dataSource);

const httpErrorFactory = {
  from: jest.fn(),
} as unknown as HttpErrorFactory;
const mockHttpErrorFactory = jest.mocked(httpErrorFactory);

describe('ConfigApi', () => {
  const baseUri = faker.internet.url();
  let fakeConfigurationService;
  let service: ConfigApi;

  beforeAll(async () => {
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('safeConfig.baseUri', baseUri);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new ConfigApi(
      dataSource,
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
          fakeConfigurationService,
          mockHttpErrorFactory,
        ),
    ).toThrow();
  });

  it('should return the chains retrieved', async () => {
    const data = [chainBuilder().build(), chainBuilder().build()];
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getChains();

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      new CacheDir('chains', 'undefined_undefined'),
      `${baseUri}/api/v1/chains`,
      { params: { limit: undefined, offset: undefined } },
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
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should return the safe apps retrieved by chainId', async () => {
    const chainId = faker.random.numeric();
    const data = [safeAppBuilder().build(), safeAppBuilder().build()];
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getSafeApps(chainId);

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      new CacheDir(`safe_apps`, `${chainId}_undefined_undefined`),
      `${baseUri}/api/v1/safe-apps/`,
      { params: { chainId, clientUrl: undefined, url: undefined } },
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should return the safe apps retrieved by chainId and url', async () => {
    const chainId = faker.random.numeric();
    const url = faker.internet.url();
    const data = [safeAppBuilder().build(), safeAppBuilder().build()];
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getSafeApps(chainId, undefined, url);

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      new CacheDir(`safe_apps`, `${chainId}_undefined_${url}`),
      `${baseUri}/api/v1/safe-apps/`,
      { params: { chainId, clientUrl: undefined, url } },
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should return the safe apps retrieved by chainId and clientUrl', async () => {
    const chainId = faker.random.numeric();
    const clientUrl = faker.internet.url();
    const data = [safeAppBuilder().build(), safeAppBuilder().build()];
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getSafeApps(chainId, clientUrl);

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      new CacheDir(`safe_apps`, `${chainId}_${clientUrl}_undefined`),
      `${baseUri}/api/v1/safe-apps/`,
      { params: { chainId, clientUrl, url: undefined } },
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should forward error', async () => {
    const expected = new DataSourceError('some unexpected error');
    mockHttpErrorFactory.from.mockReturnValue(expected);
    mockDataSource.get.mockRejectedValueOnce(new Error('Some error'));

    await expect(service.getChains()).rejects.toThrowError(expected);

    expect(mockDataSource.get).toHaveBeenCalledTimes(1);
    expect(mockHttpErrorFactory.from).toBeCalledTimes(1);
  });
});
