import { ConfigApi } from './config-api.service';
import { FakeConfigurationService } from '../../config/__tests__/fake.configuration.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import chainFactory from '../../domain/chains/entities/__tests__/chain.factory';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { DataSourceError } from '../../domain/errors/data-source.error';

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;
const mockDataSource = jest.mocked(dataSource);

const httpErrorFactory = {
  from: jest.fn(),
} as unknown as HttpErrorFactory;
const mockHttpErrorFactory = jest.mocked(httpErrorFactory);

describe('ConfigApi', () => {
  let fakeConfigurationService;
  let service: ConfigApi;

  beforeAll(async () => {
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('safeConfig.baseUri', 'https://example.url');
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
    const data = [chainFactory(), chainFactory()];
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getChains();

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      'chains',
      'undefined_undefined',
      `https://example.url/api/v1/chains`,
      { params: { limit: undefined, offset: undefined } },
    );
    expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
  });

  it('should return the chain retrieved', async () => {
    const data = chainFactory();
    mockDataSource.get.mockResolvedValue(data);

    const actual = await service.getChain(data.chainId);

    expect(actual).toBe(data);
    expect(mockDataSource.get).toBeCalledTimes(1);
    expect(mockDataSource.get).toBeCalledWith(
      `${data.chainId}_chain`,
      '',
      `https://example.url/api/v1/chains/${data.chainId}`,
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
