import type { JobsRepository } from '@/datasources/jobs/jobs.repository';

export const mockJobsRepository = {
  getJobStatus: jest.fn().mockResolvedValue(null),
} as jest.MockedObjectDeep<JobsRepository>;
