import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ZodError } from 'zod';
import { JobsRepository } from '@/datasources/jobs/jobs.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';
import { JobType } from '@/datasources/jobs/types/job-types';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';
import type { HelloWorldJobData } from '@/domain/jobs/jobs.repository.interface';

describe('JobsRepository', () => {
  let repository: JobsRepository;
  let mockQueue: jest.Mocked<Queue>;
  let mockLoggingService: jest.MockedObjectDeep<ILoggingService>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    mockLoggingService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        JobsRepository,
        { provide: getQueueToken(JOBS_QUEUE_NAME), useValue: mockQueue },
        { provide: LoggingService, useValue: mockLoggingService },
      ],
    }).compile();

    repository = moduleRef.get<JobsRepository>(JobsRepository);
  });

  describe('addHelloWorldJob', () => {
    it('should add a hello world job to the queue', async () => {
      const jobData = { message: 'Test message', timestamp: Date.now() };
      const mockJob = { id: 'test-job-id' } as unknown as Awaited<
        ReturnType<Queue['add']>
      >;
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await repository.addHelloWorldJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith(JobType.HELLO_WORLD, jobData, {
        priority: 1,
        delay: 0,
      });
      expect(result).toBe(mockJob);
      expect(mockLoggingService.info).toHaveBeenCalled();
    });

    it('should throw ZodError for invalid job data', async () => {
      const invalidJobData = { message: '', timestamp: Date.now() };

      await expect(repository.addHelloWorldJob(invalidJobData)).rejects.toThrow(
        ZodError,
      );
    });

    it('should throw ZodError for missing timestamp', async () => {
      const invalidJobData = { message: 'Test message' } as HelloWorldJobData;

      await expect(repository.addHelloWorldJob(invalidJobData)).rejects.toThrow(
        ZodError,
      );
    });
  });

  describe('getJobStatus', () => {
    it('should get job status from queue', async () => {
      const jobId = 'test-job-id';
      const mockJob = { id: jobId, name: 'hello-world' } as unknown as Awaited<
        ReturnType<Queue['getJob']>
      >;
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await repository.getJobStatus(jobId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toBe(mockJob);
    });
  });
});
