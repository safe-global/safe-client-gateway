import { faker } from '@faker-js/faker';
import { ExportApi } from './export-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { rawify } from '@/validation/entities/raw.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { transactionExportBuilder } from '@/modules/csv-export/v1/entities/__tests__/transaction-export.builder';
import { getAddress } from 'viem';
import { DataSourceError } from '@/domain/errors/data-source.error';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

describe('ExportApi', () => {
  const chainId = faker.string.numeric();
  const baseUrl = faker.internet.url({ appendSlash: false });
  const defaultExpiration = faker.number.int();
  const defaultNotFoundExpiration = faker.number.int();
  let service: ExportApi;

  beforeEach(() => {
    jest.resetAllMocks();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') return defaultExpiration;
      if (key === 'expirationTimeInSeconds.notFound.default')
        return defaultNotFoundExpiration;
      throw new Error(`Unexpected key: ${key}`);
    });
    const httpErrorFactory = new HttpErrorFactory();

    service = new ExportApi(
      chainId,
      baseUrl,
      mockCacheFirstDataSource,
      mockConfigurationService,
      httpErrorFactory,
    );
  });

  describe('export', () => {
    it('should return export data', async () => {
      const txnExport = transactionExportBuilder().build();
      const page = pageBuilder().with('results', [txnExport]).build();

      const executionDateGte = faker.date.past().toISOString();
      const executionDateLte = faker.date.recent().toISOString();
      const limit = faker.number.int({ min: 1, max: 100 });
      const offset = faker.number.int({ min: 0, max: 10 });

      const exportUrl = `${baseUrl}/api/v1/safes/${txnExport.safe}/export/`;
      mockCacheFirstDataSource.get.mockImplementation(({ url }) => {
        if (exportUrl === url) {
          return Promise.resolve(rawify(page));
        }
        throw new Error('Unexpected URL');
      });

      const actual = await service.export({
        safeAddress: txnExport.safe,
        executionDateGte,
        executionDateLte,
        limit,
        offset,
      });

      expect(actual).toStrictEqual(page);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          key: `${chainId}_transactions_export_${txnExport.safe}`,
          field: `${executionDateGte}_${executionDateLte}_${limit}_${offset}`,
        },
        url: exportUrl,
        networkRequest: {
          params: {
            execution_date__gte: executionDateGte,
            execution_date__lte: executionDateLte,
            limit: limit,
            offset: offset,
          },
        },
        expireTimeSeconds: defaultExpiration,
        notFoundExpireTimeSeconds: defaultNotFoundExpiration,
      });
    });

    it('should return export data with only safeAddress', async () => {
      const txnExport = transactionExportBuilder().build();
      const page = pageBuilder().with('results', [txnExport]).build();

      const exportUrl = `${baseUrl}/api/v1/safes/${txnExport.safe}/export/`;
      mockCacheFirstDataSource.get.mockImplementation(({ url }) => {
        if (exportUrl === url) {
          return Promise.resolve(rawify(page));
        }
        throw new Error('Unexpected URL');
      });

      const actual = await service.export({
        safeAddress: txnExport.safe,
      });

      expect(actual).toStrictEqual(page);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          key: `${chainId}_transactions_export_${txnExport.safe}`,
          field: `undefined_undefined_undefined_undefined`,
        },
        url: exportUrl,
        networkRequest: {
          params: {
            execution_date__gte: undefined,
            execution_date__lte: undefined,
            limit: undefined,
            offset: undefined,
          },
        },
        expireTimeSeconds: defaultExpiration,
        notFoundExpireTimeSeconds: defaultNotFoundExpiration,
      });
    });

    it('should forward an error', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const executionDateGte = faker.date.past().toISOString();
      const executionDateLte = faker.date.recent().toISOString();

      const errorMessage = faker.word.words();
      const statusCode = faker.internet.httpStatusCode({
        types: ['clientError', 'serverError'],
      });

      const exportUrl = `${baseUrl}/api/v1/safes/${safeAddress}/export/`;
      mockCacheFirstDataSource.get.mockImplementation(({ url }) => {
        if (exportUrl === url) {
          return Promise.reject(
            new NetworkResponseError(
              new URL(exportUrl),
              {
                status: statusCode,
              } as Response,
              new Error(errorMessage),
            ),
          );
        }
        throw new Error('Unexpected URL');
      });

      await expect(
        service.export({
          safeAddress,
          executionDateGte,
          executionDateLte,
        }),
      ).rejects.toThrow(new DataSourceError(errorMessage, statusCode));

      expect(mockCacheFirstDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
        cacheDir: {
          key: `${chainId}_transactions_export_${safeAddress}`,
          field: `${executionDateGte}_${executionDateLte}_undefined_undefined`,
        },
        url: exportUrl,
        networkRequest: {
          params: {
            execution_date__gte: executionDateGte,
            execution_date__lte: executionDateLte,
            limit: undefined,
            offset: undefined,
          },
        },
        expireTimeSeconds: defaultExpiration,
        notFoundExpireTimeSeconds: defaultNotFoundExpiration,
      });
    });
  });
});
