import { TransactionApiManager } from './transaction-api.manager';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { IConfigApi } from '../../domain/interfaces/config-api.interface';
import { ICacheService } from '../cache/cache.service.interface';
import { INetworkService } from '../network/network.service.interface';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';

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

  /**
   * In the following tests, getBackbone is used to check the parameters to
   * which {@link CacheFirstDataSource} was called with.
   */
  describe('VPC Url', () => {
    it('useVpcUrl is true', async () => {
      const chain = chainBuilder().build();
      configurationServiceMock.getOrThrow.mockImplementation((key) => {
        if (key !== 'safeTransaction.useVpcUrl')
          throw new Error(`Expected key safeTransaction.useVpcUrl. Got ${key}`);
        return true;
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
        `${chain.vpcTransactionService}/api/v1/about`,
      );
    });

    it('useVpcUrl is false', async () => {
      const chain = chainBuilder().build();
      configurationServiceMock.getOrThrow.mockImplementation((key) => {
        if (key !== 'safeTransaction.useVpcUrl')
          throw new Error(`Expected key safeTransaction.useVpcUrl. Got ${key}`);
        return false;
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
        `${chain.transactionService}/api/v1/about`,
      );
    });
  });
});
