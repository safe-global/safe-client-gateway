import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { HelloWorldProcessor } from '@/datasources/jobs/processors/hello-world.processor';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { JobType } from '@/datasources/jobs/types/job-types';
import type { HelloWorldJobData } from '@/domain/jobs/jobs.repository.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';

describe('HelloWorldProcessor', () => {
  let processor: HelloWorldProcessor;
  let mockLoggingService: jest.MockedObjectDeep<ILoggingService>;
  let mockConfigurationService: jest.MockedObjectDeep<IConfigurationService>;

  beforeEach(async () => {
    mockLoggingService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockConfigurationService = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };

    // Mock environment variable for testing
    process.env.HELLO_WORLD_JOB_DELAY_MS = '100';

    const moduleRef = await Test.createTestingModule({
      providers: [
        HelloWorldProcessor,
        { provide: LoggingService, useValue: mockLoggingService },
        { provide: IConfigurationService, useValue: mockConfigurationService },
      ],
    }).compile();

    processor = moduleRef.get<HelloWorldProcessor>(HelloWorldProcessor);
  });

  afterEach(() => {
    delete process.env.HELLO_WORLD_JOB_DELAY_MS;
  });

  describe('process', () => {
    it('should process hello world jobs successfully', async () => {
      const jobData: HelloWorldJobData = {
        message: 'Test message',
        timestamp: Date.now(),
      };

      const job = {
        id: 'test-job-id',
        name: JobType.HELLO_WORLD,
        data: jobData,
      } as Job<HelloWorldJobData>;

      await processor.process(job);

      expect(mockLoggingService.info).toHaveBeenCalledWith({
        type: LogType.JobEvent,
        source: 'HelloWorldProcessor',
        event: `Processing hello world job: ${jobData.message}`,
      });

      expect(mockLoggingService.info).toHaveBeenCalledWith({
        type: LogType.JobEvent,
        source: 'HelloWorldProcessor',
        event: `Hello World job completed! Message: ${jobData.message}, Timestamp: ${jobData.timestamp}`,
      });
    });

    it('should skip non-hello-world jobs', async () => {
      const job = {
        id: 'test-job-id',
        name: 'other-job-type',
        data: {},
      } as Job<HelloWorldJobData>;

      await processor.process(job);

      expect(mockLoggingService.info).not.toHaveBeenCalled();
    });

    it('should handle job processing with different message content', async () => {
      const jobData: HelloWorldJobData = {
        message: 'Different test message with special chars: ñáéíóú!@#$%',
        timestamp: 1640995200000,
      };

      const job = {
        id: 'test-job-2',
        name: JobType.HELLO_WORLD,
        data: jobData,
      } as Job<HelloWorldJobData>;

      await processor.process(job);

      expect(mockLoggingService.info).toHaveBeenCalledTimes(2);
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.stringContaining(jobData.message),
        }),
      );
    });
  });

  describe('event handlers', () => {
    it('should log job completion', () => {
      const job = { id: 'completed-job-id' } as Job;

      processor.onCompleted(job);

      expect(mockLoggingService.info).toHaveBeenCalledWith({
        type: LogType.JobEvent,
        source: 'HelloWorldProcessor',
        event: `Job ${job.id} completed successfully`,
      });
    });

    it('should log job failure', () => {
      const job = { id: 'failed-job-id' } as Job;
      const error = new Error('Test error message');

      processor.onFailed(job, error);

      expect(mockLoggingService.error).toHaveBeenCalledWith({
        type: LogType.JobError,
        source: 'HelloWorldProcessor',
        event: `Job ${job.id} failed: ${error.message}`,
      });
    });

    it('should log job activation', () => {
      const job = { id: 'active-job-id' } as Job;

      processor.onActive(job);

      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: LogType.JobEvent,
        source: 'HelloWorldProcessor',
        event: `Job ${job.id} started processing`,
      });
    });

    it('should handle job failure with undefined job', () => {
      const error = new Error('Critical error');

      processor.onFailed(undefined as unknown as Job, error);

      expect(mockLoggingService.error).toHaveBeenCalledWith({
        type: LogType.JobError,
        source: 'HelloWorldProcessor',
        event: `Job undefined failed: ${error.message}`,
      });
    });
  });
});
