import type { Job } from 'bullmq';

export const IJobQueueService = Symbol('IJobQueueService');

export interface IJobQueueService {
  /**
   * Retrieves the status of a job by its ID
   * @param jobId - The unique identifier of the job
   * @returns Promise resolving to the Job object or null if not found
   */
  getJobStatus(jobId: string): Promise<Job | null>;
}
