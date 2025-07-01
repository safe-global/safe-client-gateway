import type { IJobQueueService } from '@/domain/interfaces/job-queue.interface';

export const mockJobQueueService = {
  getJobStatus: jest.fn().mockResolvedValue(null),
} as jest.MockedObjectDeep<IJobQueueService>;
