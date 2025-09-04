import type { IConfigurationService } from '@/config/configuration.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import { CsvExportConsumer } from '@/modules/csv-export/v1/consumers/csv-export.consumer';
import type { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import {
  csvExportJobDataBuilder,
  csvExportJobResponseBuilder,
} from '@/modules/csv-export/v1/entities/__tests__/csv-export-job-data.builder';
import type {
  CsvExportJobData,
  CsvExportJobResponse,
} from '@/modules/csv-export/v1/entities/csv-export-job-data.entity';
import { faker } from '@faker-js/faker/.';
import type { Job } from 'bullmq';

const csvExportService = {
  export: jest.fn(),
} as jest.MockedObjectDeep<CsvExportService>;
const mockCsvExportService = jest.mocked(csvExportService);

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

describe('CsvExportConsumer', () => {
  let consumer: CsvExportConsumer;
  let mockWorker: { concurrency: number };

  beforeEach(() => {
    jest.resetAllMocks();

    mockWorker = { concurrency: 1 };

    consumer = new CsvExportConsumer(
      mockLoggingService,
      mockCsvExportService,
      mockConfigurationService,
    );

    // Mock the worker property
    Object.defineProperty(consumer, 'worker', {
      value: mockWorker,
      writable: true,
    });
  });

  describe('onModuleInit', () => {
    it('should set worker concurrency from configuration and log debug message', () => {
      const expectedConcurrency = 5;
      mockConfigurationService.getOrThrow.mockReturnValue(expectedConcurrency);

      consumer.onModuleInit();

      expect(mockConfigurationService.getOrThrow).toHaveBeenCalledWith(
        'csvExport.queue.concurrency',
      );
      expect(mockWorker.concurrency).toBe(expectedConcurrency);
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: LogType.JobEvent,
        source: 'CsvExportConsumer',
        event: `BullMq Worker concurrency set to ${expectedConcurrency}`,
      });
    });

    it('should handle different concurrency values correctly', () => {
      const testCases = [1, 3, 10, 50];

      testCases.forEach((concurrency) => {
        jest.resetAllMocks();
        mockConfigurationService.getOrThrow.mockReturnValue(concurrency);

        consumer.onModuleInit();

        expect(mockWorker.concurrency).toBe(concurrency);
      });
    });

    it('should override the initial processor decorator concurrency setting', () => {
      const initialConcurrency = mockWorker.concurrency;
      const newConcurrency = initialConcurrency + 10;
      mockConfigurationService.getOrThrow.mockReturnValue(newConcurrency);

      expect(mockWorker.concurrency).toBe(initialConcurrency);

      consumer.onModuleInit();

      expect(mockWorker.concurrency).toBe(newConcurrency);
      expect(mockWorker.concurrency).not.toBe(initialConcurrency);
    });

    it('should throw error when configuration service throws', () => {
      const expectedError = new Error('Configuration not found');
      mockConfigurationService.getOrThrow.mockImplementation(() => {
        throw expectedError;
      });

      expect(() => consumer.onModuleInit()).toThrow(expectedError);
      expect(mockLoggingService.debug).not.toHaveBeenCalled();
    });
  });

  describe('process', () => {
    it('should process job and return download URL', async () => {
      const jobData = csvExportJobDataBuilder().build();
      const expectedResponse = csvExportJobResponseBuilder().build();
      const mockJob = {
        id: faker.string.uuid(),
        timestamp: faker.date.recent().getTime(),
        data: jobData,
        attemptsMade: 1,
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<CsvExportJobData, CsvExportJobResponse>;

      mockCsvExportService.export.mockResolvedValue(
        expectedResponse.downloadUrl,
      );

      const result = await consumer.process(mockJob);

      expect(result).toEqual(expectedResponse);
      expect(mockCsvExportService.export).toHaveBeenCalledWith(
        {
          chainId: jobData.chainId,
          safeAddress: jobData.safeAddress,
          timestamp: mockJob.timestamp,
          executionDateGte: jobData.executionDateGte,
          executionDateLte: jobData.executionDateLte,
          limit: jobData.limit,
          offset: jobData.offset,
        },
        expect.any(Function),
      );
      expect(mockLoggingService.info).toHaveBeenCalledWith({
        type: LogType.JobEvent,
        source: 'CsvExportConsumer',
        event: `Processing job ${mockJob.id}`,
        attemptsMade: mockJob.attemptsMade,
      });
    });
  });

  describe('onCompleted', () => {
    it('should log completion message', () => {
      const jobId = faker.string.uuid();
      const mockJob = { id: jobId } as Job;

      consumer.onCompleted(mockJob);

      expect(mockLoggingService.info).toHaveBeenCalledWith({
        type: LogType.JobEvent,
        source: 'CsvExportConsumer',
        event: `Job ${jobId} completed`,
      });
    });
  });

  describe('onFailed', () => {
    it('should log failure message with error', () => {
      const jobId = faker.string.uuid();
      const mockJob = { id: jobId } as Job;
      const error = new Error('Test error');

      consumer.onFailed(mockJob, error);

      expect(mockLoggingService.error).toHaveBeenCalledWith({
        type: LogType.JobError,
        source: 'CsvExportConsumer',
        event: `Job ${jobId} failed. ${error}`,
      });
    });
  });

  describe('onProgress', () => {
    it('should log progress message', () => {
      const jobId = faker.string.uuid();
      const progress = 50;
      const mockJob = { id: jobId } as Job;

      consumer.onProgress(mockJob, progress);

      expect(mockLoggingService.info).toHaveBeenCalledWith({
        type: LogType.JobEvent,
        source: 'CsvExportConsumer',
        event: `Job ${jobId} progress: ${progress}%`,
      });
    });
  });

  describe('onWorkerError', () => {
    it('should log worker error message', () => {
      const error = new Error('Worker error');

      consumer.onWorkerError(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith({
        type: LogType.JobError,
        source: 'CsvExportConsumer',
        event: `Worker encountered an error: ${error}`,
      });
    });
  });
});
