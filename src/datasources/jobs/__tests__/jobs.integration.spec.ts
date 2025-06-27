import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { HelloWorldJobData } from '@/datasources/jobs/jobs.service';
import { JobsService } from '@/datasources/jobs/jobs.service';
import { JOBS_QUEUE_NAME } from '@/datasources/jobs/jobs.constants';
import { JobType } from '@/datasources/jobs/types/job-types';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';

describe('Jobs Integration (Unit)', () => {
  let jobsService: JobsService;
  let mockQueue: jest.Mocked<Queue>;
  let mockLoggingService: jest.MockedObjectDeep<ILoggingService>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      name: JOBS_QUEUE_NAME,
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

    jobsService = moduleRef.get<JobsService>(JobsService);
  });

  describe('Job Processing Flow', () => {
    it('should add and process hello world job', async () => {
      const jobData: HelloWorldJobData = {
        message: 'Integration test message',
        timestamp: Date.now(),
      };

      const mockJob = {
        id: 'test-job-id',
        name: JobType.HELLO_WORLD,
        data: jobData,
      } as unknown as Awaited<ReturnType<Queue['add']>>;

      mockQueue.add.mockResolvedValue(mockJob);
      mockQueue.getJob.mockResolvedValue(mockJob);

      const job = await jobsService.addHelloWorldJob(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe(JobType.HELLO_WORLD);
      expect(job.data).toEqual(jobData);

      // Verify job was added to queue
      const retrievedJob = await jobsService.getJobStatus(job.id!);
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob!.id).toBe(job.id);
    });

    it('should return null for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const status = await jobsService.getJobStatus('non-existent-job-id');
      expect(status).toBeNull();
    });

    it('should log job creation', async () => {
      const jobData: HelloWorldJobData = {
        message: 'Logging test message',
        timestamp: Date.now(),
      };

      const mockJob = {
        id: 'log-test-job-id',
        name: JobType.HELLO_WORLD,
        data: jobData,
      } as unknown as Awaited<ReturnType<Queue['add']>>;

      mockQueue.add.mockResolvedValue(mockJob);

      await jobsService.addHelloWorldJob(jobData);

      expect(mockLoggingService.info).toHaveBeenCalledWith({
        type: 'JOB_EVENT',
        source: 'JobsService',
        event: `Adding hello world job with message: ${jobData.message}`,
      });
    });
  });

  describe('Queue Configuration', () => {
    it('should have correct queue name', () => {
      expect(mockQueue.name).toBe(JOBS_QUEUE_NAME);
    });

    it('should handle multiple jobs', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          name: JobType.HELLO_WORLD,
          data: { message: 'Job 1', timestamp: Date.now() },
        },
        {
          id: 'job-2',
          name: JobType.HELLO_WORLD,
          data: { message: 'Job 2', timestamp: Date.now() },
        },
        {
          id: 'job-3',
          name: JobType.HELLO_WORLD,
          data: { message: 'Job 3', timestamp: Date.now() },
        },
      ] as unknown as Array<Awaited<ReturnType<Queue['add']>>>;

      mockQueue.add.mockImplementation((_, data) => {
        const index = mockJobs.findIndex(
          (job) => job.data.message === data.message,
        );
        return Promise.resolve(mockJobs[index]);
      });

      const jobs = await Promise.all([
        jobsService.addHelloWorldJob({
          message: 'Job 1',
          timestamp: Date.now(),
        }),
        jobsService.addHelloWorldJob({
          message: 'Job 2',
          timestamp: Date.now(),
        }),
        jobsService.addHelloWorldJob({
          message: 'Job 3',
          timestamp: Date.now(),
        }),
      ]);

      expect(jobs).toHaveLength(3);
      jobs.forEach((job, index) => {
        expect(job.id).toBeDefined();
        expect(job.data.message).toBe(`Job ${index + 1}`);
      });
    });
  });
});
