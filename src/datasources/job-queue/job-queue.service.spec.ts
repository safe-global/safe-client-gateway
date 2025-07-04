import type { Queue } from 'bullmq';
import { JobQueueService } from '@/datasources/job-queue/job-queue.service';
import { JobType } from '@/datasources/job-queue/types/job-types';

describe('JobQueueService', () => {
  let service: JobQueueService;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    jest.resetAllMocks();

    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    service = new JobQueueService(mockQueue);
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

    it('should return null if job does not exist', async () => {
      const jobId = 'non-existent-job-id';
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus(jobId);

      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toBeNull();
    });

    it('should propagate errors from the queue', async () => {
      const jobId = 'error-job-id';
      const error = new Error('Queue error');
      mockQueue.getJob.mockRejectedValue(error);

      await expect(service.getJobStatus(jobId)).rejects.toThrow('Queue error');
      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
    });
  });

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const jobName = JobType.CSV_EXPORT;
      const jobData = { 'csv-export': { message: 'hi', timestamp: 1 } };
      const mockJob = { id: '123', name: jobName } as unknown as Awaited<
        ReturnType<Queue['add']>
      >;
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.addJob(jobName, jobData);

      expect(mockQueue.add).toHaveBeenCalledWith(jobName, jobData);
      expect(result).toBe(mockJob);
    });

    it('should propagate errors from the queue', async () => {
      const jobName = JobType.CSV_EXPORT;
      const jobData = { 'csv-export': { message: 'bye', timestamp: 2 } };
      mockQueue.add.mockRejectedValue(new Error('add error'));

      await expect(service.addJob(jobName, jobData)).rejects.toThrow(
        'add error',
      );
      expect(mockQueue.add).toHaveBeenCalledWith(jobName, jobData);
    });
  });
});
