import { ConfigApi } from './config-api.service';
import { FakeConfigurationService } from '../../common/config/__tests__/fake.configuration.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import chainFactory from '../../domain/chains/entities/__tests__/chain.factory';

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;

const mockDataSource = jest.mocked(dataSource);

describe('ConfigApi', () => {
  const fakeConfigurationService = new FakeConfigurationService();
  fakeConfigurationService.set('safeConfig.baseUri', 'https://example.url');

  const service: ConfigApi = new ConfigApi(
    dataSource,
    fakeConfigurationService,
  );

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();

    await expect(
      () => new ConfigApi(dataSource, fakeConfigurationService),
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
  });

  it('should forward error', async () => {
    mockDataSource.get = jest
      .fn()
      .mockRejectedValueOnce(new Error('Some error'));

    await expect(service.getChains()).rejects.toThrow('Some error');

    expect(mockDataSource.get).toHaveBeenCalledTimes(1);
  });
});
