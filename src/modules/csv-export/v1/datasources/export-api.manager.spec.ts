// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { ExportApiManager } from './export-api.manager';

const mockConfigurationService = vi.mocked({
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>);

const mockConfigApi = vi.mocked({
  getChain: vi.fn(),
} as MockedObject<IConfigApi>);

const mockDataSource = vi.mocked({
  get: vi.fn(),
} as MockedObject<CacheFirstDataSource>);

const mockHttpErrorFactory = {} as MockedObject<HttpErrorFactory>;

describe('ExportApiManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
