import type { Job } from 'bullmq';
import type { IJobsRepository, HelloWorldJobData } from '@/domain/jobs/jobs.repository.interface';

export const mockIJobsRepository = {
  addHelloWorldJob: jest.fn().mockImplementation(
    (data: HelloWorldJobData): Promise<Job> => {
      const mockJob = {
        id: 'mock-job-id',
        name: 'hello-world',
        data,
      } as unknown as Job;
      return Promise.resolve(mockJob);
    },
  ),
  getJobStatus: jest.fn().mockResolvedValue(null),
} as jest.MockedObjectDeep<IJobsRepository>;