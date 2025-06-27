import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { Job } from 'bullmq';
import { JobsService } from '@/routes/jobs/jobs.service';
import { IJobsRepository } from '@/domain/jobs/jobs.repository.interface';
import type {
  JobStatusResponseDto,
  JobStatusDto,
} from '@/routes/jobs/entities/job-status.dto';
import { mockIJobsRepository } from '@/domain/jobs/__tests__/jobs.repository.interface.mock';

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: IJobsRepository, useValue: mockIJobsRepository },
      ],
    }).compile();

    service = moduleRef.get<JobsService>(JobsService);
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      const jobId = 'test-job-id';
      const mockJob = {
        id: jobId,
        name: 'test-job',
        data: { key: 'value' },
        progress: 50,
        processedOn: 1640995200000,
        finishedOn: 1640995260000,
        failedReason: undefined,
        returnvalue: 'success',
      } as unknown as Job;

      mockIJobsRepository.getJobStatus.mockResolvedValue(mockJob);

      const result = await service.getJobStatus(jobId);

      const expectedResponse: JobStatusResponseDto = {
        id: jobId,
        name: 'test-job',
        data: { key: 'value' },
        progress: 50,
        processedOn: 1640995200000,
        finishedOn: 1640995260000,
        failedReason: undefined,
        returnvalue: 'success',
      };

      expect(mockIJobsRepository.getJobStatus).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(expectedResponse);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      const jobId = 'non-existent-job';
      mockIJobsRepository.getJobStatus.mockResolvedValue(null);

      await expect(service.getJobStatus(jobId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockIJobsRepository.getJobStatus).toHaveBeenCalledWith(jobId);
    });

    it('should handle job with partial data', async () => {
      const jobId = 'partial-job-id';
      const mockJob = {
        id: jobId,
        name: 'test-job',
        data: { message: 'test' },
        progress: undefined,
        processedOn: undefined,
        finishedOn: undefined,
        failedReason: undefined,
        returnvalue: undefined,
      } as unknown as Job;

      mockIJobsRepository.getJobStatus.mockResolvedValue(mockJob);

      const result = await service.getJobStatus(jobId);

      const expectedResponse: JobStatusResponseDto = {
        id: jobId,
        name: 'test-job',
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
        name: 'test-job',
        data: {},
        progress: { current: 5, total: 10 },
      } as unknown as Job;

      mockIJobsRepository.getJobStatus.mockResolvedValue(mockJob);

      const result = await service.getJobStatus(jobId);

      expect((result as JobStatusDto).progress).toEqual({
        current: 5,
        total: 10,
      });
    });
  });
});
