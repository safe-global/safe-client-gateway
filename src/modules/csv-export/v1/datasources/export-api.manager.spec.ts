import { faker } from '@faker-js/faker';
import { ExportApiManager } from './export-api.manager';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { rawify } from '@/validation/entities/raw.entity';
import { getAddress } from 'viem';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockConfigApi = jest.mocked({
  getChain: jest.fn(),
} as jest.MockedObjectDeep<IConfigApi>);

const mockDataSource = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

const mockHttpErrorFactory = {} as jest.MockedObjectDeep<HttpErrorFactory>;

describe('ExportApiManager', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  const txServiceUrl = faker.internet.url({ appendSlash: false });
  const vpcTxServiceUrl = faker.internet.url({ appendSlash: false });

  it.each([
    [true, vpcTxServiceUrl],
    [false, txServiceUrl],
  ])('uses vpc url %s', async (useVpcUrl, expectedUrl) => {
    const chain = chainBuilder()
      .with('transactionService', txServiceUrl)
      .with('vpcTransactionService', vpcTxServiceUrl)
      .build();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'safeTransaction.useVpcUrl') return useVpcUrl;
      if (key === 'expirationTimeInSeconds.default') return faker.number.int();
      if (key === 'expirationTimeInSeconds.notFound.default')
        return faker.number.int();
      throw new Error(`Unexpected key: ${key}`);
    });

    mockConfigApi.getChain.mockResolvedValue(rawify(chain));

    const manager = new ExportApiManager(
      mockConfigurationService,
      mockConfigApi,
      mockDataSource,
      mockHttpErrorFactory,
    );

    const exportApi = await manager.getApi(chain.chainId);
    mockDataSource.get.mockResolvedValue(rawify({}));

    const args = {
      safeAddress: getAddress(faker.finance.ethereumAddress()),
      executionDateGte: faker.date.past().toISOString(),
      executionDateLte: faker.date.recent().toISOString(),
    };
    await exportApi.export(args);

    expect(mockDataSource.get).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${expectedUrl}/api/v1/safes/${args.safeAddress}/export/`,
      }),
    );
  });

  it('caches api instances', async () => {
    const chain = chainBuilder().build();
    mockConfigurationService.getOrThrow.mockReturnValue(false);
    mockConfigApi.getChain.mockResolvedValue(rawify(chain));

    const manager = new ExportApiManager(
      mockConfigurationService,
      mockConfigApi,
      mockDataSource,
      mockHttpErrorFactory,
    );

    const exportApi1 = await manager.getApi(chain.chainId);
    const exportApi2 = await manager.getApi(chain.chainId);

    expect(exportApi1).toBe(exportApi2);
  });
});
