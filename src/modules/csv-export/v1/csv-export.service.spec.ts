import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import type { CsvService } from '@/modules/csv-export/csv-utils/csv.service';
import { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import type { IExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import {
  transactionExportBuilder,
  transformTransactionExport,
} from '@/modules/csv-export/v1/entities/__tests__/transaction-export.builder';
import { faker } from '@faker-js/faker/.';
import type { Writable } from 'stream';
import { PassThrough, Readable, Transform } from 'stream';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { rawify } from '@/validation/entities/raw.entity';
import fs from 'fs';
import type { IExportApi } from '@/modules/csv-export/v1/datasources/export-api.interface';
import type { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { Page } from '@/domain/entities/page.entity';
import { mkdir, rm, readFile, access } from 'fs/promises';
import path from 'path';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { UnrecoverableError } from 'bullmq';
import type { TransactionExport } from '@/modules/csv-export/v1/entities/transaction-export.entity';
import type { CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3';
import { pipeline } from 'stream/promises';
import type { Address } from 'viem';

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
  createUploadStream: jest.fn(),
  getSignedUrl: jest.fn(),
  getFileContent: jest.fn(),
} as jest.MockedObjectDeep<ICloudStorageApiService>;
const mockCloudStorageApiService = jest.mocked(cloudStorageApiService);

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const mockConfigurationService = jest.mocked(configurationService);

const loggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockLoggingService = jest.mocked(loggingService);

describe('CsvExportService', () => {
  let service: CsvExportService;
  let mockPage: Page<TransactionExport>;
  let streamData: Array<TransactionExport>;

  const mockUploadStream = {
    ETag: faker.string.alphanumeric(),
  } as CompleteMultipartUploadCommandOutput;

  const mockTransactionExport: TransactionExport =
    transactionExportBuilder().build();

  const expectedSignedUrl = faker.internet.url();

  const exportArgs = {
    chainId: faker.string.numeric(1),
    safeAddress: faker.finance.ethereumAddress() as Address,
    timestamp: faker.date.recent().getTime(),
    executionDateGte: faker.date.past().toISOString().split('T')[0],
    executionDateLte: faker.date.recent().toISOString().split('T')[0],
    limit: faker.number.int({ min: 1, max: 10 }),
    offset: faker.number.int({ min: 0, max: 10 }),
  };

  const setupCsvServiceMock = (): void => {
    // Mock toCsv to simulate consuming the readable stream using pipeline
    streamData = [];
    mockCsvService.toCsv.mockImplementation(
      async (readable: Readable, writable: Writable) => {
        // Transform stream to collect data for testing
        const collectTransform = new Transform({
          objectMode: true,
          transform(chunk: TransactionExport, _, callback): void {
            streamData.push(chunk);
            // Convert object to CSV-like string for the writable stream
            this.push(`${chunk.safe}\n`);
            callback();
          },
        });

        await pipeline(readable, collectTransform, writable);
      },
    );
  };

  const setupMocks = (): void => {
    mockPage = pageBuilder()
      .with('results', [mockTransactionExport])
      .with('next', null)
      .build() as Page<TransactionExport>;

    mockExportApiManager.getApi.mockResolvedValue(mockExportApi);

    mockExportApi.export.mockResolvedValue(rawify(mockPage));
    mockCloudStorageApiService.createUploadStream.mockResolvedValue(
      mockUploadStream,
    );
    mockCloudStorageApiService.getSignedUrl.mockResolvedValue(
      expectedSignedUrl,
    );

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

    setupCsvServiceMock();
  };

  describe('export', () => {
    beforeEach(() => {
      jest.resetAllMocks();

      setupMocks();

      service = new CsvExportService(
        mockExportApiManager,
        mockCsvService,
        mockJobQueueService,
        mockCloudStorageApiService,
        mockConfigurationService,
        mockLoggingService,
      );
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should successfully export transactions to CSV and return signed URL', async () => {
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

      expect(
        mockCloudStorageApiService.createUploadStream,
      ).toHaveBeenCalledWith(
        `transactions_export_${exportArgs.chainId}_${exportArgs.safeAddress}_${exportArgs.timestamp}.csv`,
        expect.any(PassThrough),
        {
          ContentType: 'text/csv',
        },
      );

      expect(mockCsvService.toCsv).toHaveBeenCalledWith(
        expect.any(Readable),
        expect.any(PassThrough),
        expect.anything(),
      );
    });

    it('should generate empty CSV when no data found', async () => {
      mockPage = pageBuilder()
        .with('results', [])
        .with('next', null)
        .build() as Page<TransactionExport>;
      mockExportApi.export.mockResolvedValue(rawify(mockPage));

      const result = await service.export(exportArgs);

      expect(result).toBe(expectedSignedUrl);
      expect(mockCsvService.toCsv).toHaveBeenCalledWith(
        expect.any(Readable),
        expect.any(PassThrough),
        expect.anything(),
      );

      // Verify the readable stream was called correctly
      const readableArg = mockCsvService.toCsv.mock.calls[0][0] as Readable;
      expect(readableArg).toBeInstanceOf(Readable);
      expect(streamData).toHaveLength(0);
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
      mockCloudStorageApiService.createUploadStream.mockRejectedValue(
        new Error('Upload failed'),
      );

      await expect(service.export(exportArgs)).rejects.toThrow('Upload failed');
    });

    it('should throw error when CSV generation fails', async () => {
      mockCsvService.toCsv.mockImplementation(
        async (readable: Readable, writable: Writable) => {
          const collectTransform = new Transform({
            objectMode: true,
            transform(_chunk, _, callback): void {
              callback(new Error('CSV generation failed'));
            },
          });

          await pipeline(readable, collectTransform, writable);
        },
      );

      await expect(service.export(exportArgs)).rejects.toThrow(
        'CSV generation failed',
      );
    });

    it('should throw error when signed URL generation fails', async () => {
      mockCloudStorageApiService.getSignedUrl.mockRejectedValue(
        new Error('Signed URL generation failed'),
      );

      await expect(service.export(exportArgs)).rejects.toThrow(
        'Signed URL generation failed',
      );
    });

    it('should handle pagination and fetch all pages', async () => {
      const mockTransactionExport2 = transactionExportBuilder().build();
      const mockTransactionExport3 = transactionExportBuilder().build();

      const mockPage1 = pageBuilder()
        .with('results', [mockTransactionExport])
        .with('next', 'https://api.example.com/export?limit=100&offset=100')
        .with('count', 3)
        .build();

      const mockPage2 = pageBuilder()
        .with('results', [mockTransactionExport2])
        .with('next', 'https://api.example.com/export?limit=100&offset=200')
        .with('count', 3)
        .build();

      // Third page without next URL (last page)
      const mockPage3 = pageBuilder()
        .with('results', [mockTransactionExport3])
        .with('next', null)
        .with('count', 3)
        .build();

      mockExportApi.export
        .mockResolvedValueOnce(rawify(mockPage1))
        .mockResolvedValueOnce(rawify(mockPage2))
        .mockResolvedValueOnce(rawify(mockPage3));

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

      expect(mockCsvService.toCsv).toHaveBeenCalledWith(
        expect.any(Readable),
        expect.any(PassThrough),
        expect.anything(),
      );

      const expectedCombinedResults = [
        transformTransactionExport(mockTransactionExport),
        transformTransactionExport(mockTransactionExport2),
        transformTransactionExport(mockTransactionExport3),
      ];

      expect(streamData).toHaveLength(3);
      expect(streamData).toEqual(expectedCombinedResults);

      expect(mockLoggingService.debug).toHaveBeenCalledWith(
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

      expect(mockLoggingService.debug).toHaveBeenCalledWith(
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

      expect(mockLoggingService.debug).toHaveBeenCalledWith(
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
          event: 'All pages (3) have been successfully fetched',
        }),
      );
    });

    it('should handle pagination with default values', async () => {
      const exportArgsNoPagination = {
        ...exportArgs,
        limit: undefined,
        offset: undefined,
      };

      await service.export(exportArgsNoPagination);

      expect(mockExportApi.export).toHaveBeenCalledWith({
        safeAddress: exportArgs.safeAddress,
        executionDateGte: exportArgs.executionDateGte,
        executionDateLte: exportArgs.executionDateLte,
        limit: 100,
        offset: 0,
      });
    });

    it('should calculate next offset/limit when URL has no parameters', async () => {
      const nextUrl = 'https://api.example.com/export?limit=25';
      const mockPage1 = pageBuilder()
        .with('results', [mockTransactionExport])
        .with('next', nextUrl)
        .with('count', 2)
        .build();

      const mockPage2 = pageBuilder()
        .with('results', [mockTransactionExport])
        .with('next', null)
        .with('count', 2)
        .build();

      mockExportApi.export
        .mockResolvedValueOnce(rawify(mockPage1))
        .mockResolvedValueOnce(rawify(mockPage2));

      await service.export(exportArgs);

      // Verify first call uses original parameters
      expect(mockExportApi.export).toHaveBeenNthCalledWith(1, {
        safeAddress: exportArgs.safeAddress,
        executionDateGte: exportArgs.executionDateGte,
        executionDateLte: exportArgs.executionDateLte,
        limit: exportArgs.limit,
        offset: exportArgs.offset,
      });

      // Verify second call calculates next offset
      expect(mockExportApi.export).toHaveBeenNthCalledWith(2, {
        safeAddress: exportArgs.safeAddress,
        executionDateGte: exportArgs.executionDateGte,
        executionDateLte: exportArgs.executionDateLte,
        limit: 25, // From URL
        offset: exportArgs.offset + 25, // Calculated based on initial request + new limit
      });

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          chainId: exportArgs.chainId,
          safeAddress: exportArgs.safeAddress,
          pageCount: 1,
          message: `nextUrl is missing required parameter(s): offset. URL: ${nextUrl}`,
        }),
      );
    });

    it('should log and throw error when individual page fails', async () => {
      mockPage = pageBuilder()
        .with('results', [mockTransactionExport])
        .with('next', 'https://api.example.com/export?limit=100&offset=100')
        .with('count', 2)
        .build() as Page<TransactionExport>;

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
        safeAddress: faker.finance.ethereumAddress() as Address,
        timestamp: faker.date.recent().getTime(),
      };

      const result = await service.export(exportArgsWithoutDates);

      expect(result).toBe(expectedSignedUrl);

      expect(
        mockCloudStorageApiService.createUploadStream,
      ).toHaveBeenCalledWith(
        `transactions_export_${exportArgsWithoutDates.chainId}_${exportArgsWithoutDates.safeAddress}_${exportArgsWithoutDates.timestamp}.csv`,
        expect.any(PassThrough),
        {
          ContentType: 'text/csv',
        },
      );
    });

    it('should generate correct filename when only one date is provided', async () => {
      const exportArgsPartialDates = {
        chainId: faker.string.numeric(1),
        safeAddress: faker.finance.ethereumAddress() as Address,
        timestamp: faker.date.recent().getTime(),
        executionDateGte: faker.date.past().toISOString().split('T')[0],
      };

      const result = await service.export(exportArgsPartialDates);

      expect(result).toBe(expectedSignedUrl);

      expect(
        mockCloudStorageApiService.createUploadStream,
      ).toHaveBeenCalledWith(
        `transactions_export_${exportArgsPartialDates.chainId}_${exportArgsPartialDates.safeAddress}_${exportArgsPartialDates.timestamp}.csv`,
        expect.any(PassThrough),
        {
          ContentType: 'text/csv',
        },
      );
    });

    it('should call progress callback with correct progress values', async () => {
      const progressCallback = jest.fn().mockResolvedValue(undefined);
      const mockTransactionExport2 = transactionExportBuilder().build();

      const mockPage1 = pageBuilder()
        .with('results', [mockTransactionExport])
        .with('next', 'https://api.example.com/export?limit=100&offset=100')
        .with('count', 5)
        .build();

      const mockPage2 = pageBuilder()
        .with('results', [mockTransactionExport2])
        .with('next', null)
        .with('count', 5)
        .build();

      mockExportApi.export
        .mockResolvedValueOnce(rawify(mockPage1))
        .mockResolvedValueOnce(rawify(mockPage2));

      await service.export(exportArgs, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(4);
      // First page: 1/5 * 70 = 14%
      expect(progressCallback).toHaveBeenNthCalledWith(1, 14);
      // Second page: 2/5 * 70 = 28%
      expect(progressCallback).toHaveBeenNthCalledWith(2, 28);
      expect(progressCallback).toHaveBeenNthCalledWith(3, 90);
      expect(progressCallback).toHaveBeenNthCalledWith(4, 100);
    });

    it('should handle slow AWS upload completion', async () => {
      let resolveUpload: (value: CompleteMultipartUploadCommandOutput) => void;
      const uploadPromise = new Promise<CompleteMultipartUploadCommandOutput>(
        (resolve) => {
          resolveUpload = resolve;
        },
      );

      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCloudStorageApiService.createUploadStream.mockReturnValue(
        uploadPromise,
      );

      const exportPromise = service.export(exportArgs);

      // Simulate slow upload
      setTimeout(() => resolveUpload(mockUploadStream), 50);

      const result = await exportPromise;

      expect(result).toBe(expectedSignedUrl);
      expect(
        mockCloudStorageApiService.createUploadStream,
      ).toHaveBeenCalledWith(
        expect.stringContaining('transactions_export_'),
        expect.any(PassThrough),
        { ContentType: 'text/csv' },
      );
      expect(mockCloudStorageApiService.getSignedUrl).toHaveBeenCalledWith(
        expect.stringContaining('transactions_export_'),
        3600,
      );
    });

    it('should handle many pages without memory issues', async () => {
      // Create 100 small pages to test streaming performance
      let callCount = 0;
      mockExportApi.export.mockImplementation(() => {
        const pageIndex = callCount++;
        const page = pageBuilder()
          .with('results', [transactionExportBuilder().build()])
          .with(
            'next',
            pageIndex < 99
              ? `https://api.example.com/export?offset=${pageIndex + 1}`
              : null,
          )
          .build();
        return Promise.resolve(rawify(page));
      });

      const result = await service.export(exportArgs);
      expect(result).toBeDefined();
      expect(mockExportApi.export).toHaveBeenCalledTimes(100);
      expect(streamData).toHaveLength(100);
    });
  });

  describe('export with local storage', () => {
    let csvRow: string = '';
    const csvHeader = 'id,chainId,type,timestamp';
    const localBaseDir = 'assets/csv-export';
    const fileName = `transactions_export_${exportArgs.chainId}_${exportArgs.safeAddress}_${exportArgs.timestamp}.csv`;

    const setupMocks = (): void => {
      mockPage = pageBuilder()
        .with('results', [mockTransactionExport])
        .with('next', null)
        .build() as Page<TransactionExport>;

      // Simulate writing to the stream with faker data
      csvRow = `${faker.string.uuid()},${faker.string.numeric(1)},${faker.lorem.word()},${faker.date.recent().toISOString()}`;
      mockCsvService.toCsv.mockImplementation(
        async (readable: Readable, stream) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const _ of readable) {
            // Just consume the data
          }
          // Write to the stream and wait for it to finish
          stream.write(csvHeader + '\n');
          stream.write(csvRow + '\n');
          stream.end();

          // Wait for the stream to finish writing to disk
          return new Promise<void>((resolve, reject) => {
            stream.on('finish', () => resolve());
            stream.on('error', reject);
          });
        },
      );

      mockExportApiManager.getApi.mockResolvedValue(mockExportApi);
      mockExportApi.export.mockResolvedValue(rawify(mockPage));
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
    };

    beforeEach(async () => {
      jest.resetAllMocks();
      await mkdir(localBaseDir, { recursive: true });

      setupMocks();

      service = new CsvExportService(
        mockExportApiManager,
        mockCsvService,
        mockJobQueueService,
        mockCloudStorageApiService,
        mockConfigurationService,
        mockLoggingService,
      );
    });

    afterEach(async () => {
      try {
        const filePath = path.resolve(localBaseDir, fileName);
        await access(filePath);
        await rm(filePath);
      } catch {
        // File doesn't exist, nothing to clean up
      }
      jest.clearAllMocks();
    });

    it('should handle local storage type and return local file path', async () => {
      const expectedLocalPath = path.resolve(localBaseDir, fileName);
      const result = await service.export(exportArgs);

      expect(result).toBe(expectedLocalPath);

      expect(
        mockCloudStorageApiService.createUploadStream,
      ).not.toHaveBeenCalled();
      expect(mockCloudStorageApiService.getSignedUrl).not.toHaveBeenCalled();

      expect(mockCsvService.toCsv).toHaveBeenCalledWith(
        expect.any(Readable),
        expect.any(fs.WriteStream),
        expect.anything(),
      );

      const fileContent = await readFile(expectedLocalPath, 'utf-8');
      expect(fileContent).toContain(csvHeader);
      expect(fileContent).toContain(csvRow);
    });
  });
});
