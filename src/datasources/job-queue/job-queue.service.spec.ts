import type { Queue } from 'bullmq';
import { JobQueueService } from '@/datasources/job-queue/job-queue.service';

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
});
