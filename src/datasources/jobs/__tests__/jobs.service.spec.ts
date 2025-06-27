import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { JobsService } from '@/datasources/jobs/jobs.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';
import { JobType } from '@/datasources/jobs/types/job-types';
import { JOBS_QUEUE_NAME } from '@/datasources/jobs/jobs.constants';

describe('JobsService', () => {
  let service: JobsService;
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
        JobsService,
        { provide: getQueueToken(JOBS_QUEUE_NAME), useValue: mockQueue },
        { provide: LoggingService, useValue: mockLoggingService },
      ],
    }).compile();

    service = moduleRef.get<JobsService>(JobsService);
  });

  describe('addHelloWorldJob', () => {
    it('should add a hello world job to the queue', async () => {
      const jobData = { message: 'Test message', timestamp: Date.now() };
      const mockJob = { id: 'test-job-id' } as unknown as Awaited<
        ReturnType<Queue['add']>
      >;
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.addHelloWorldJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith(JobType.HELLO_WORLD, jobData, {
        priority: 1,
        delay: 0,
      });
      expect(result).toBe(mockJob);
      expect(mockLoggingService.info).toHaveBeenCalled();
    });
  });

  describe('getJobStatus', () => {
    it('should get job status from queue', async () => {
      const jobId = 'test-job-id';
      const mockJob = { id: jobId, name: 'hello-world' } as unknown as Awaited<
        ReturnType<Queue['getJob']>
      >;
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus(jobId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toBe(mockJob);
    });
  });
});
