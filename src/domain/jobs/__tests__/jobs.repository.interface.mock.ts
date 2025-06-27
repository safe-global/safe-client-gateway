import type { IJobsRepository } from '@/domain/jobs/jobs.repository.interface';

export const mockIJobsRepository = {
  getJobStatus: jest.fn().mockResolvedValue(null),
} as jest.MockedObjectDeep<IJobsRepository>;
