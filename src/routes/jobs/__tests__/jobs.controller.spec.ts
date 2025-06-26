import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { JobsController } from '@/routes/jobs/jobs.controller';
import { JobsService } from '@/datasources/jobs/jobs.service';

describe('JobsController', () => {
  let controller: JobsController;
  let mockJobsService: jest.Mocked<JobsService>;

  beforeEach(async () => {
    mockJobsService = {
      getJobStatus: jest.fn(),
    } as unknown as jest.Mocked<JobsService>;

    const moduleRef = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: mockJobsService }],
    }).compile();

    controller = moduleRef.get<JobsController>(JobsController);
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

      mockJobsService.getJobStatus.mockResolvedValue(mockJob);

      const result = await controller.getJobStatus(jobId);

      expect(mockJobsService.getJobStatus).toHaveBeenCalledWith(jobId);
      expect(result).toEqual({
        id: jobId,
        name: 'hello-world',
        data: { message: 'test', timestamp: 123456789 },
        progress: 50,
        processedOn: 1640995200000,
        finishedOn: 1640995260000,
        failedReason: undefined,
        returnvalue: 'success',
      });
    });

    it('should return error when job does not exist', async () => {
      const jobId = 'non-existent-job';
      mockJobsService.getJobStatus.mockResolvedValue(null);

      const result = await controller.getJobStatus(jobId);

      expect(mockJobsService.getJobStatus).toHaveBeenCalledWith(jobId);
      expect(result).toEqual({ error: 'Job not found' });
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

      mockJobsService.getJobStatus.mockResolvedValue(mockJob);

      const result = await controller.getJobStatus(jobId);

      expect(result).toEqual({
        id: jobId,
        name: 'hello-world',
        data: { message: 'test' },
        progress: undefined,
        processedOn: undefined,
        finishedOn: undefined,
        failedReason: undefined,
        returnvalue: undefined,
      });
    });

    it('should handle job with failed status', async () => {
      const jobId = 'failed-job-id';
      const mockJob = {
        id: jobId,
        name: 'hello-world',
        data: { message: 'test', timestamp: 123456789 },
        progress: 75,
        processedOn: 1640995200000,
        finishedOn: undefined,
        failedReason: 'Connection timeout',
        returnvalue: undefined,
      } as unknown as Job;

      mockJobsService.getJobStatus.mockResolvedValue(mockJob);

      const result = await controller.getJobStatus(jobId);

      expect(result).toEqual({
        id: jobId,
        name: 'hello-world',
        data: { message: 'test', timestamp: 123456789 },
        progress: 75,
        processedOn: 1640995200000,
        finishedOn: undefined,
        failedReason: 'Connection timeout',
        returnvalue: undefined,
      });
    });

    it('should handle various progress types', async () => {
      const jobId = 'progress-job-id';
      const mockJob = {
        id: jobId,
        name: 'hello-world',
        data: {},
        progress: { current: 5, total: 10 }, // object progress
      } as unknown as Job;

      mockJobsService.getJobStatus.mockResolvedValue(mockJob);

      const result = await controller.getJobStatus(jobId);

      expect(result).toEqual(
        expect.objectContaining({
          progress: { current: 5, total: 10 },
        }),
      );
    });
  });
});
