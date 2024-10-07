import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { TransactionApiManager } from '@/datasources/transaction-api/transaction-api.manager';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import type { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const configurationServiceMock = jest.mocked(configurationService);

const configApi = {
  getChain: jest.fn(),
} as jest.MockedObjectDeep<IConfigApi>;

const configApiMock = jest.mocked(configApi);

const dataSource = {
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>;

const dataSourceMock = jest.mocked(dataSource);

const cacheService = {} as jest.MockedObjectDeep<ICacheService>;

const httpErrorFactory = {} as jest.MockedObjectDeep<HttpErrorFactory>;

const networkService = {} as jest.MockedObjectDeep<INetworkService>;

const mockLoggingService = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

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
    const indexingExpirationTimeInSeconds = faker.number.int();
    const notFoundExpireTimeSeconds = faker.number.int();
    const ownersTtlSeconds = faker.number.int();
    configurationServiceMock.getOrThrow.mockImplementation((key) => {
      if (key === 'safeTransaction.useVpcUrl') return useVpcUrl;
      else if (key === 'expirationTimeInSeconds.default')
        return expirationTimeInSeconds;
      else if (key === 'expirationTimeInSeconds.indexing')
        return indexingExpirationTimeInSeconds;
      else if (key === 'expirationTimeInSeconds.notFound.default')
        return notFoundExpireTimeSeconds;
      else if (key === 'expirationTimeInSeconds.notFound.contract')
        return notFoundExpireTimeSeconds;
      else if (key === 'expirationTimeInSeconds.notFound.token')
        return notFoundExpireTimeSeconds;
      else if (key === 'owners.ownersTtlSeconds') return ownersTtlSeconds;

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
      mockLoggingService,
    );

    const transactionApi = await target.getApi(chain.chainId);
    await transactionApi.getBackbone();

    expect(dataSourceMock.get).toHaveBeenCalledWith({
      cacheDir: expect.anything(),
      url: `${expectedUrl}/api/v1/about`,
      notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
      expireTimeSeconds: expirationTimeInSeconds,
    });
  });
});
