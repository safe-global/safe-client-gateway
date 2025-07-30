import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import type { CsvService } from '@/modules/csv-export/csv-utils/csv.service';
import { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import type { IExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import type { TransactionExportRaw } from '@/modules/csv-export/v1/entities/__tests__/transaction-export.builder';
import {
  transactionExportRawBuilder,
  convertRawToTransactionExport,
} from '@/modules/csv-export/v1/entities/__tests__/transaction-export.builder';
import { faker } from '@faker-js/faker/.';
import { PassThrough } from 'stream';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { rawify } from '@/validation/entities/raw.entity';
import type { IExportApi } from '@/modules/csv-export/v1/datasources/export-api.interface';
import type { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { Page } from '@/domain/entities/page.entity';
import { mkdir, rm, readFile } from 'fs/promises';
import path from 'path';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { UnrecoverableError } from 'bullmq';

const exportApi = {
  export: jest.fn(),
} as jest.MockedObjectDeep<IExportApi>;
const mockExportApi = jest.mocked(exportApi);

const exportApiManager = {
  getApi: jest.fn(),
  destroyApi: jest.fn(),
} as jest.MockedObjectDeep<IExportApiManager>;
const mockExportApiManager = jest.mocked(exportApiManager);

const csvService = {
  toCsv: jest.fn(),
} as jest.MockedObjectDeep<CsvService>;
const mockCsvService = jest.mocked(csvService);

const jobQueueService = {
  addJob: jest.fn(),
  getJob: jest.fn(),
} as jest.MockedObjectDeep<IJobQueueService>;
const mockJobQueueService = jest.mocked(jobQueueService);

const cloudStorageApiService = {
  uploadStream: jest.fn(),
  getSignedUrl: jest.fn(),
  getFileContent: jest.fn(),
} as jest.MockedObjectDeep<ICloudStorageApiService>;
const mockCloudStorageApiService = jest.mocked(cloudStorageApiService);

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const mockConfigurationService = jest.mocked(configurationService);

const loggingService = {
  info: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockLoggingService = jest.mocked(loggingService);

describe('CsvExportService', () => {
  let service: CsvExportService;
  let mockPage: Page<TransactionExportRaw>;
  const mockTransactionExportRaw: TransactionExportRaw =
    transactionExportRawBuilder().build();

  const exportArgs = {
    chainId: faker.string.numeric(1),
    safeAddress: faker.finance.ethereumAddress() as `0x${string}`,
    executionDateGte: faker.date.past().toISOString().split('T')[0],
    executionDateLte: faker.date.recent().toISOString().split('T')[0],
    limit: faker.number.int({ min: 1, max: 10 }),
    offset: faker.number.int({ min: 0, max: 10 }),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockExportApiManager.getApi.mockResolvedValue(mockExportApi);
    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      switch (key) {
        case 'csvExport.signedUrlTtlSeconds':
          return 3600;
        case 'csvExport.fileStorage.type':
          return 'aws';
        case 'csvExport.fileStorage.local.baseDir':
          return '/tmp/csv-exports';
        default:
          return 3600;
      }
    });

    service = new CsvExportService(
      mockExportApiManager,
      mockCsvService,
      mockJobQueueService,
      mockCloudStorageApiService,
      mockConfigurationService,
      mockLoggingService,
    );

    mockPage = pageBuilder()
      .with('results', [mockTransactionExportRaw])
      .with('next', null)
      .build() as Page<TransactionExportRaw>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('export', () => {
    it('should successfully export transactions to CSV and return signed URL', async () => {
      const expectedSignedUrl = 'https://signed-url.example.com';

      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockResolvedValue(
        expectedSignedUrl,
      );

      const result = await service.export(exportArgs);

      expect(result).toBe(expectedSignedUrl);

      expect(mockExportApiManager.getApi).toHaveBeenCalledWith(
        exportArgs.chainId,
      );

      expect(mockExportApi.export).toHaveBeenCalledTimes(1);
      expect(mockExportApi.export).toHaveBeenCalledWith({
        safeAddress: exportArgs.safeAddress,
        executionDateGte: exportArgs.executionDateGte,
        executionDateLte: exportArgs.executionDateLte,
        limit: exportArgs.limit,
        offset: exportArgs.offset,
      });

      expect(mockCloudStorageApiService.uploadStream).toHaveBeenCalledWith(
        `${exportArgs.chainId}_${exportArgs.safeAddress}_${exportArgs.executionDateGte}_${exportArgs.executionDateLte}.csv`,
        expect.any(PassThrough),
        {
          ContentType: 'text/csv',
        },
      );

      const parsedTxnExport = convertRawToTransactionExport(
        mockTransactionExportRaw,
      );

      expect(mockCsvService.toCsv).toHaveBeenCalledWith(
        [parsedTxnExport],
        expect.any(PassThrough),
        expect.anything(),
      );
    });

    it('should generate empty CSV when no data found', async () => {
      mockPage = pageBuilder()
        .with('results', [])
        .with('next', null)
        .build() as Page<TransactionExportRaw>;
      mockExportApi.export.mockResolvedValue(rawify(mockPage));

      const expectedSignedUrl = 'https://signed-url.example.com';
      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockResolvedValue(
        expectedSignedUrl,
      );

      const result = await service.export(exportArgs);

      expect(result).toBe(expectedSignedUrl);

      // Verify empty array was passed to CSV service
      expect(mockCsvService.toCsv).toHaveBeenCalledWith(
        [],
        expect.any(PassThrough),
        expect.anything(),
      );
    });

    it('should throw error when exportApi call fails', async () => {
      mockExportApi.export.mockRejectedValue(new Error('API Error'));

      await expect(service.export(exportArgs)).rejects.toThrow('API Error');
    });

    it('should throw UnrecoverableError when exportApi returns 404', async () => {
      mockExportApi.export.mockRejectedValue(
        new DataSourceError('Not found', 404),
      );

      await expect(service.export(exportArgs)).rejects.toThrow(
        UnrecoverableError,
      );
      await expect(service.export(exportArgs)).rejects.toThrow(
        'Transactions not found.',
      );
    });

    it('should throw error when upload to S3 fails', async () => {
      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCloudStorageApiService.uploadStream.mockRejectedValue(
        new Error('Upload failed'),
      );

      await expect(service.export(exportArgs)).rejects.toThrow('Upload failed');
    });

    it('should throw error when CSV generation fails', async () => {
      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCsvService.toCsv.mockRejectedValue(
        new Error('CSV generation failed'),
      );

      await expect(service.export(exportArgs)).rejects.toThrow(
        'CSV generation failed',
      );
    });

    it('should throw error when signed URL generation fails', async () => {
      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockRejectedValue(
        new Error('Signed URL generation failed'),
      );

      await expect(service.export(exportArgs)).rejects.toThrow(
        'Signed URL generation failed',
      );
    });

    it('should handle pagination and fetch all pages', async () => {
      const expectedSignedUrl = 'https://signed-url.example.com';
      const mockTransactionExportRaw2 = transactionExportRawBuilder().build();
      const mockTransactionExportRaw3 = transactionExportRawBuilder().build();

      const mockPage1 = pageBuilder()
        .with('results', [mockTransactionExportRaw])
        .with('next', 'https://api.example.com/export?limit=100&offset=100')
        .with('count', 3)
        .build();

      const mockPage2 = pageBuilder()
        .with('results', [mockTransactionExportRaw2])
        .with('next', 'https://api.example.com/export?limit=100&offset=200')
        .with('count', 3)
        .build();

      // Third page without next URL (last page)
      const mockPage3 = pageBuilder()
        .with('results', [mockTransactionExportRaw3])
        .with('next', null)
        .with('count', 3)
        .build();

      mockExportApi.export
        .mockResolvedValueOnce(rawify(mockPage1))
        .mockResolvedValueOnce(rawify(mockPage2))
        .mockResolvedValueOnce(rawify(mockPage3));

      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockResolvedValue(
        expectedSignedUrl,
      );

      const result = await service.export(exportArgs);

      expect(result).toBe(expectedSignedUrl);

      expect(mockExportApi.export).toHaveBeenCalledTimes(3);

      // Verify first call uses original parameters
      expect(mockExportApi.export).toHaveBeenNthCalledWith(1, {
        safeAddress: exportArgs.safeAddress,
        executionDateGte: exportArgs.executionDateGte,
        executionDateLte: exportArgs.executionDateLte,
        limit: exportArgs.limit,
        offset: exportArgs.offset,
      });

      // Verify second call uses parsed parameters from next URL
      expect(mockExportApi.export).toHaveBeenNthCalledWith(2, {
        safeAddress: exportArgs.safeAddress,
        executionDateGte: exportArgs.executionDateGte,
        executionDateLte: exportArgs.executionDateLte,
        limit: 100,
        offset: 100,
      });

      // Verify third call uses parsed parameters from next URL
      expect(mockExportApi.export).toHaveBeenNthCalledWith(3, {
        safeAddress: exportArgs.safeAddress,
        executionDateGte: exportArgs.executionDateGte,
        executionDateLte: exportArgs.executionDateLte,
        limit: 100,
        offset: 200,
      });

      const expectedCombinedResults = [
        convertRawToTransactionExport(mockTransactionExportRaw),
        convertRawToTransactionExport(mockTransactionExportRaw2),
        convertRawToTransactionExport(mockTransactionExportRaw3),
      ];

      expect(mockCsvService.toCsv).toHaveBeenCalledWith(
        expectedCombinedResults,
        expect.any(PassThrough),
        expect.anything(),
      );

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          chainId: exportArgs.chainId,
          safeAddress: exportArgs.safeAddress,
          pageCount: 1,
          resultsCount: 1,
          totalCount: 3,
          hasNext: true,
        }),
      );

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          chainId: exportArgs.chainId,
          safeAddress: exportArgs.safeAddress,
          pageCount: 2,
          resultsCount: 1,
          totalCount: 3,
          hasNext: true,
        }),
      );

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          chainId: exportArgs.chainId,
          safeAddress: exportArgs.safeAddress,
          pageCount: 3,
          resultsCount: 1,
          totalCount: 3,
          hasNext: false,
        }),
      );

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          event: 'All pages (3) have been succesfully fetched',
        }),
      );
    });

    it('should handle pagination with default values from URL params', async () => {
      const mockPage1 = pageBuilder()
        .with('results', [mockTransactionExportRaw])
        .with('next', 'https://api.example.com/export')
        .with('count', 1)
        .build();

      const mockPage2 = pageBuilder()
        .with('results', [])
        .with('next', null)
        .with('count', 1)
        .build();

      mockExportApi.export
        .mockResolvedValueOnce(rawify(mockPage1))
        .mockResolvedValueOnce(rawify(mockPage2));

      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockResolvedValue(
        'https://signed-url.example.com',
      );

      await service.export(exportArgs);

      // Verify second call uses default values
      expect(mockExportApi.export).toHaveBeenNthCalledWith(2, {
        safeAddress: exportArgs.safeAddress,
        executionDateGte: exportArgs.executionDateGte,
        executionDateLte: exportArgs.executionDateLte,
        limit: 100,
        offset: 0,
      });
    });

    it('should log and throw error when individual page fails', async () => {
      mockPage = pageBuilder()
        .with('results', [mockTransactionExportRaw])
        .with('next', 'https://api.example.com/export?limit=100&offset=100')
        .with('count', 2)
        .build() as Page<TransactionExportRaw>;

      mockExportApi.export
        .mockResolvedValueOnce(rawify(mockPage))
        .mockRejectedValueOnce(new Error('Second page API error'));

      await expect(service.export(exportArgs)).rejects.toThrow(
        'Second page API error',
      );

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          chainId: exportArgs.chainId,
          safeAddress: exportArgs.safeAddress,
          pageCount: 2,
          error: expect.any(Error),
        }),
      );
    });

    it('should generate correct filename when dates are not provided', async () => {
      const exportArgsWithoutDates = {
        chainId: faker.string.numeric(1),
        safeAddress: faker.finance.ethereumAddress() as `0x${string}`,
      };

      const expectedSignedUrl = 'https://signed-url.example.com';

      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockResolvedValue(
        expectedSignedUrl,
      );

      const result = await service.export(exportArgsWithoutDates);

      expect(result).toBe(expectedSignedUrl);

      expect(mockCloudStorageApiService.uploadStream).toHaveBeenCalledWith(
        `${exportArgsWithoutDates.chainId}_${exportArgsWithoutDates.safeAddress}_-_-.csv`,
        expect.any(PassThrough),
        {
          ContentType: 'text/csv',
        },
      );
    });

    it('should generate correct filename when only one date is provided', async () => {
      const exportArgsPartialDates = {
        chainId: faker.string.numeric(1),
        safeAddress: faker.finance.ethereumAddress() as `0x${string}`,
        executionDateGte: faker.date.past().toISOString().split('T')[0],
      };

      const expectedSignedUrl = 'https://signed-url.example.com';

      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockResolvedValue(
        expectedSignedUrl,
      );

      const result = await service.export(exportArgsPartialDates);

      expect(result).toBe(expectedSignedUrl);

      expect(mockCloudStorageApiService.uploadStream).toHaveBeenCalledWith(
        `${exportArgsPartialDates.chainId}_${exportArgsPartialDates.safeAddress}_${exportArgsPartialDates.executionDateGte}_-.csv`,
        expect.any(PassThrough),
        {
          ContentType: 'text/csv',
        },
      );
    });

    it('should call progress callback with correct progress values', async () => {
      const progressCallback = jest.fn().mockResolvedValue(undefined);
      const mockTransactionExportRaw2 = transactionExportRawBuilder().build();

      const mockPage1 = pageBuilder()
        .with('results', [mockTransactionExportRaw])
        .with('next', 'https://api.example.com/export?limit=100&offset=100')
        .with('count', 5)
        .build();

      const mockPage2 = pageBuilder()
        .with('results', [mockTransactionExportRaw2])
        .with('next', null)
        .with('count', 5)
        .build();

      mockExportApi.export
        .mockResolvedValueOnce(rawify(mockPage1))
        .mockResolvedValueOnce(rawify(mockPage2));

      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockResolvedValue(
        'https://signed-url.example.com',
      );

      await service.export(exportArgs, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(5);
      // First page: 1/5 * 60 = 12%
      expect(progressCallback).toHaveBeenNthCalledWith(1, 12);
      // Second page: 2/5 * 100 * 0.6 = 24%
      expect(progressCallback).toHaveBeenNthCalledWith(2, 24);

      expect(progressCallback).toHaveBeenNthCalledWith(3, 80);
      expect(progressCallback).toHaveBeenNthCalledWith(4, 90);
      expect(progressCallback).toHaveBeenNthCalledWith(5, 100);
    });
  });

  describe('export with local storage', () => {
    let csvRow: string = '';
    const csvHeader = 'id,chainId,type,timestamp';
    const localBaseDir = 'assets/csv-export';
    const fileName = `${exportArgs.chainId}_${exportArgs.safeAddress}_${exportArgs.executionDateGte}_${exportArgs.executionDateLte}.csv`;

    beforeEach(async () => {
      jest.resetAllMocks();
      await mkdir(localBaseDir, { recursive: true });

      // Simulate writing to the stream with faker data
      csvRow = `${faker.string.uuid()},${faker.string.numeric(1)},${faker.lorem.word()},${faker.date.recent().toISOString()}`;
      mockCsvService.toCsv.mockImplementation(async (_, stream) => {
        stream.write(csvHeader + '\n');
        stream.write(csvRow + '\n');
        return Promise.resolve();
      });

      mockExportApiManager.getApi.mockResolvedValue(mockExportApi);
      mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
        switch (key) {
          case 'csvExport.signedUrlTtlSeconds':
            return 3600;
          case 'csvExport.fileStorage.type':
            return 'local';
          case 'csvExport.fileStorage.local.baseDir':
            return localBaseDir;
          default:
            return 3600;
        }
      });

      service = new CsvExportService(
        mockExportApiManager,
        mockCsvService,
        mockJobQueueService,
        mockCloudStorageApiService,
        mockConfigurationService,
        mockLoggingService,
      );

      mockPage = pageBuilder()
        .with('results', [mockTransactionExportRaw])
        .with('next', null)
        .build() as Page<TransactionExportRaw>;
    });

    afterEach(async () => {
      await rm(path.resolve(localBaseDir, fileName));
      jest.clearAllMocks();
    });

    it('should handle local storage type and return local file path', async () => {
      const expectedLocalPath = path.resolve(localBaseDir, fileName);
      mockExportApi.export.mockResolvedValue(rawify(mockPage));

      const result = await service.export(exportArgs);

      expect(result).toBe(expectedLocalPath);

      expect(mockCloudStorageApiService.uploadStream).not.toHaveBeenCalled();
      expect(mockCloudStorageApiService.getSignedUrl).not.toHaveBeenCalled();

      expect(mockCsvService.toCsv).toHaveBeenCalledWith(
        [convertRawToTransactionExport(mockTransactionExportRaw)],
        expect.any(PassThrough),
        expect.anything(),
      );

      const fileContent = await readFile(expectedLocalPath, 'utf-8');
      expect(fileContent).toContain(csvHeader);
      expect(fileContent).toContain(csvRow);
    });
  });
});
