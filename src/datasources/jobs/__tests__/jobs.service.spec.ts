import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { JobsRepository } from '@/datasources/jobs/jobs.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';

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

  describe('getJobStatus', () => {
    it('should get job status from queue', async () => {
      const jobId = 'test-job-id';
      const mockJob = { id: jobId, name: 'test-job' } as unknown as Awaited<
        ReturnType<Queue['getJob']>
      >;
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await repository.getJobStatus(jobId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toBe(mockJob);
    });
  });
});
