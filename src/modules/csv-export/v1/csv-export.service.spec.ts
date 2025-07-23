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
  getJobStatus: jest.fn(),
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

describe('CsvExportService', () => {
  let service: CsvExportService;
  const mockTransactionExportRaw: TransactionExportRaw =
    transactionExportRawBuilder().build();

  beforeEach(() => {
    jest.resetAllMocks();

    mockExportApiManager.getApi.mockResolvedValue(mockExportApi);
    mockConfigurationService.getOrThrow.mockReturnValue(3600);

    service = new CsvExportService(
      mockExportApiManager,
      mockCsvService,
      mockJobQueueService,
      mockCloudStorageApiService,
      mockConfigurationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportTransactions', () => {
    const exportArgs = {
      chainId: faker.string.numeric(1),
      safeAddress: faker.finance.ethereumAddress() as `0x${string}`,
      executionDateGte: faker.date.past().toISOString().split('T')[0],
      executionDateLte: faker.date.recent().toISOString().split('T')[0],
      limit: faker.number.int({ min: 1, max: 10 }),
      offset: faker.number.int({ min: 0, max: 10 }),
    };

    it('should successfully export transactions to CSV and return signed URL', async () => {
      const mockPage = pageBuilder()
        .with('results', [mockTransactionExportRaw])
        .build();

      const expectedSignedUrl = 'https://signed-url.example.com';

      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockResolvedValue(
        expectedSignedUrl,
      );

      const result = await service.exportTransactions(exportArgs);

      expect(result).toBe(expectedSignedUrl);

      expect(mockExportApiManager.getApi).toHaveBeenCalledWith(
        exportArgs.chainId,
      );
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
      );
    });

    it('should throw error when no data found', async () => {
      const mockPage = pageBuilder()
        .with('results', [])
        .with('count', 0)
        .build();
      mockExportApi.export.mockResolvedValue(rawify(mockPage));

      await expect(service.exportTransactions(exportArgs)).rejects.toThrow(
        'No data found for the given parameters',
      );
    });

    it('should throw error when exportApi call fails', async () => {
      mockExportApi.export.mockRejectedValue(new Error('API Error'));

      await expect(service.exportTransactions(exportArgs)).rejects.toThrow(
        'API Error',
      );
    });

    it('should throw error when upload to S3 fails', async () => {
      const mockPage = pageBuilder()
        .with('results', [mockTransactionExportRaw])
        .build();

      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCloudStorageApiService.uploadStream.mockRejectedValue(
        new Error('Upload failed'),
      );

      await expect(service.exportTransactions(exportArgs)).rejects.toThrow(
        'Upload failed',
      );
    });

    it('should throw error when CSV generation fails', async () => {
      const mockPage = pageBuilder()
        .with('results', [mockTransactionExportRaw])
        .build();

      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCsvService.toCsv.mockRejectedValue(
        new Error('CSV generation failed'),
      );

      await expect(service.exportTransactions(exportArgs)).rejects.toThrow(
        'CSV generation failed',
      );
    });

    it('should throw error when signed URL generation fails', async () => {
      const mockPage = pageBuilder()
        .with('results', [mockTransactionExportRaw])
        .build();

      mockExportApi.export.mockResolvedValue(rawify(mockPage));
      mockCloudStorageApiService.uploadStream.mockResolvedValue(
        's3://bucket/file.csv',
      );
      mockCloudStorageApiService.getSignedUrl.mockRejectedValue(
        new Error('Signed URL generation failed'),
      );

      await expect(service.exportTransactions(exportArgs)).rejects.toThrow(
        'Signed URL generation failed',
      );
    });
  });
});
