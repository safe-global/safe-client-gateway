import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobsController } from '@/routes/jobs/jobs.controller';
import { JobsService } from '@/routes/jobs/jobs.service';
import type { JobStatusResponseDto } from '@/routes/jobs/entities/job-status.dto';
import { mockJobsService } from '@/routes/jobs/__tests__/jobs.service.mock';

describe('JobsController', () => {
  let controller: JobsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: mockJobsService }],
    }).compile();

    controller = moduleRef.get<JobsController>(JobsController);
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      const jobId = 'test-job-id';
      const mockJobStatusResponse: JobStatusResponseDto = {
        id: jobId,
        name: 'hello-world',
        data: { message: 'test', timestamp: 123456789 },
        progress: 50,
        processedOn: 1640995200000,
        finishedOn: 1640995260000,
        failedReason: undefined,
        returnvalue: 'success',
      };

      mockJobsService.getJobStatus.mockResolvedValue(mockJobStatusResponse);

      const result = await controller.getJobStatus(jobId);

      expect(mockJobsService.getJobStatus).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(mockJobStatusResponse);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      const jobId = 'non-existent-job';
      mockJobsService.getJobStatus.mockRejectedValue(new NotFoundException('Job not found'));

      await expect(controller.getJobStatus(jobId)).rejects.toThrow(NotFoundException);
      expect(mockJobsService.getJobStatus).toHaveBeenCalledWith(jobId);
    });

    it('should handle job with partial data', async () => {
      const jobId = 'partial-job-id';
      const mockJobStatusResponse: JobStatusResponseDto = {
        id: jobId,
        name: 'hello-world',
        data: { message: 'test' },
        progress: undefined,
        processedOn: undefined,
        finishedOn: undefined,
        failedReason: undefined,
        returnvalue: undefined,
      };

      mockJobsService.getJobStatus.mockResolvedValue(mockJobStatusResponse);

      const result = await controller.getJobStatus(jobId);

      expect(result).toEqual(mockJobStatusResponse);
    });

    it('should handle job with failed status', async () => {
      const jobId = 'failed-job-id';
      const mockJobStatusResponse: JobStatusResponseDto = {
        id: jobId,
        name: 'hello-world',
        data: { message: 'test', timestamp: 123456789 },
        progress: 75,
        processedOn: 1640995200000,
        finishedOn: undefined,
        failedReason: 'Connection timeout',
        returnvalue: undefined,
      };

      mockJobsService.getJobStatus.mockResolvedValue(mockJobStatusResponse);

      const result = await controller.getJobStatus(jobId);

      expect(result).toEqual(mockJobStatusResponse);
    });

    it('should handle various progress types', async () => {
      const jobId = 'progress-job-id';
      const mockJobStatusResponse: JobStatusResponseDto = {
        id: jobId,
        name: 'hello-world',
        data: {},
        progress: { current: 5, total: 10 }, // object progress
      };

      mockJobsService.getJobStatus.mockResolvedValue(mockJobStatusResponse);

      const result = await controller.getJobStatus(jobId);

      expect(result).toEqual(
        expect.objectContaining({
          progress: { current: 5, total: 10 },
        }),
      );
    });
  });
});
