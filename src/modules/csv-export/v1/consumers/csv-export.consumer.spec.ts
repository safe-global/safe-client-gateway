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
import { CSV_EXPORT_WORKER_CONCURRENCY } from '@/domain/common/entities/jobs.constants';

const csvExportService = {
  export: jest.fn(),
} as jest.MockedObjectDeep<CsvExportService>;
const mockCsvExportService = jest.mocked(csvExportService);

const loggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockLoggingService = jest.mocked(loggingService);

describe('CsvExportConsumer', () => {
  let consumer: CsvExportConsumer;

  beforeEach(() => {
    jest.resetAllMocks();
    consumer = new CsvExportConsumer(mockLoggingService, mockCsvExportService);
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

  describe('event handlers', () => {
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

  describe('configuration', () => {
    it('should use concurrency value from configuration constants', () => {
      expect(CSV_EXPORT_WORKER_CONCURRENCY).toBeDefined();
      expect(typeof CSV_EXPORT_WORKER_CONCURRENCY).toBe('number');
      expect(CSV_EXPORT_WORKER_CONCURRENCY).toBeGreaterThan(0);
    });
  });
});
