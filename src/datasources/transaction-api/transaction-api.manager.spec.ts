import { TransactionApiManager } from './transaction-api.manager';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ICacheService } from '../cache/cache.service.interface';
import { INetworkService } from '../network/network.service.interface';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { faker } from '@faker-js/faker';

const configurationService = {
  getOrThrow: jest.fn(),
} as unknown as IConfigurationService;

const configurationServiceMock = jest.mocked(configurationService);

const configApi = {
  getChain: jest.fn(),
} as unknown as IConfigApi;

const configApiMock = jest.mocked(configApi);

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;

const dataSourceMock = jest.mocked(dataSource);

const cacheService = {} as unknown as ICacheService;

const httpErrorFactory = {} as unknown as HttpErrorFactory;

const networkService = {} as unknown as INetworkService;

describe('Transaction API Manager Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const txServiceUrl = faker.internet.url({ appendSlash: false });
  const vpcTxServiceUrl = faker.internet.url({ appendSlash: false });

  /**
   * In the following tests, getBackbone is used to check the parameters to
   * which {@link CacheFirstDataSource} was called with.
   */
  it.each([
    [true, vpcTxServiceUrl],
    [false, txServiceUrl],
  ])('vpcUrl is %s', async (useVpcUrl, expectedUrl) => {
    const chain = chainBuilder()
      .with('transactionService', txServiceUrl)
      .with('vpcTransactionService', vpcTxServiceUrl)
      .build();
    const expirationTimeInSeconds = faker.number.int();
    const notFoundExpireTimeSeconds = faker.number.int();
    const messagesCache = faker.datatype.boolean();
    configurationServiceMock.getOrThrow.mockImplementation((key) => {
      if (key === 'safeTransaction.useVpcUrl') return useVpcUrl;
      else if (key === 'expirationTimeInSeconds.default')
        return expirationTimeInSeconds;
      else if (key === 'expirationTimeInSeconds.notFound.default')
        return notFoundExpireTimeSeconds;
      else if (key === 'expirationTimeInSeconds.notFound.contract')
        return notFoundExpireTimeSeconds;
      else if (key === 'expirationTimeInSeconds.notFound.token')
        return notFoundExpireTimeSeconds;
      else if (key === 'features.messagesCache') return messagesCache;
      throw new Error(`Unexpected key: ${key}`);
    });
    configApiMock.getChain.mockResolvedValue(chain);
    const target = new TransactionApiManager(
      configurationServiceMock,
      configApiMock,
      dataSourceMock,
      cacheService,
      httpErrorFactory,
      networkService,
    );

    const transactionApi = await target.getTransactionApi(chain.chainId);
    await transactionApi.getBackbone();

    expect(dataSourceMock.get).toBeCalledWith(
      expect.anything(),
      `${expectedUrl}/api/v1/about`,
      notFoundExpireTimeSeconds,
      undefined,
      expirationTimeInSeconds,
    );
  });
});
