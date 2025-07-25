import type { JobData } from '@/datasources/job-queue/types/job-types';
import type { IJobQueueService } from '@/domain/interfaces/job-queue.interface';

export interface TestJobData extends JobData {
  message: string;
}

export const mockJobQueueService = {
  getJobStatus: jest.fn().mockResolvedValue(null),
  addJob: jest.fn().mockResolvedValue({
    id: 'mock-job-id',
    name: 'mock-job-name',
    data: {},
    attemptsMade: 0,
    opts: {},
    progress: 0,
    timestamp: Date.now(),
  }),
} as jest.MockedObjectDeep<IJobQueueService>;
