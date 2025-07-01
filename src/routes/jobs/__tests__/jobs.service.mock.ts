import type { JobsService } from '@/routes/jobs/jobs.service';
import type { JobStatusResponseDto } from '@/routes/jobs/entities/job-status.dto';

export const mockJobsService = {
  getJobStatus: jest
    .fn()
    .mockImplementation((jobId: string): Promise<JobStatusResponseDto> => {
      const mockResponse: JobStatusResponseDto = {
        id: jobId,
        name: 'hello-world',
        data: { message: 'test', timestamp: 123456789 },
        progress: 50,
        processedOn: 1640995200000,
        finishedOn: 1640995260000,
        failedReason: undefined,
        returnvalue: 'success',
      };
      return Promise.resolve(mockResponse);
    }),
} as jest.MockedObjectDeep<JobsService>;
