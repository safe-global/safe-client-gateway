import { NotFoundException } from '@nestjs/common';
import type { Job } from 'bullmq';
import { JobsService } from '@/routes/jobs/jobs.service';
import type {
  JobStatusResponseDto,
  JobStatusDto,
} from '@/routes/jobs/entities/job-status.dto';
import { mockJobQueueService } from '@/datasources/job-queue/__test__/job-queue.service.mock';

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new JobsService(mockJobQueueService);
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      const jobId = 'test-job-id';
      const mockJob = {
        id: jobId,
        name: 'hello-world',
        data: { message: 'test', timestamp: 123456789 },
        progress: 50,
        processedOn: 1640995200000,
        finishedOn: 1640995260000,
        failedReason: undefined,
        returnvalue: 'success',
      } as unknown as Job;

      mockJobQueueService.getJobStatus.mockResolvedValue(mockJob);

      const result = await service.getJobStatus(jobId);

      const expectedResponse: JobStatusResponseDto = {
        id: jobId,
        name: 'hello-world',
        data: { message: 'test', timestamp: 123456789 },
        progress: 50,
        processedOn: 1640995200000,
        finishedOn: 1640995260000,
        failedReason: undefined,
        returnvalue: 'success',
      };

      expect(mockJobQueueService.getJobStatus).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(expectedResponse);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      const jobId = 'non-existent-job';
      mockJobQueueService.getJobStatus.mockResolvedValue(null);

      await expect(service.getJobStatus(jobId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockJobQueueService.getJobStatus).toHaveBeenCalledWith(jobId);
    });

    it('should handle job with partial data', async () => {
      const jobId = 'partial-job-id';
      const mockJob = {
        id: jobId,
        name: 'hello-world',
        data: { message: 'test' },
        progress: undefined,
        processedOn: undefined,
        finishedOn: undefined,
        failedReason: undefined,
        returnvalue: undefined,
      } as unknown as Job;

      mockJobQueueService.getJobStatus.mockResolvedValue(mockJob);

      const result = await service.getJobStatus(jobId);

      const expectedResponse: JobStatusResponseDto = {
        id: jobId,
        name: 'hello-world',
        data: { message: 'test' },
        progress: undefined,
        processedOn: undefined,
        finishedOn: undefined,
        failedReason: undefined,
        returnvalue: undefined,
      };

      expect(result).toEqual(expectedResponse);
    });

    it('should handle various progress types', async () => {
      const jobId = 'progress-job-id';
      const mockJob = {
        id: jobId,
        name: 'hello-world',
        data: {},
        progress: { current: 5, total: 10 },
      } as unknown as Job;

      mockJobQueueService.getJobStatus.mockResolvedValue(mockJob);

      const result = await service.getJobStatus(jobId);

      expect((result as JobStatusDto).progress).toEqual({
        current: 5,
        total: 10,
      });
    });
  });
});
