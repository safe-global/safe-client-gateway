import type {
  JobData,
  JobTypeName,
} from '@/datasources/job-queue/types/job-types';
import type { Job } from 'bullmq';

export const IJobQueueService = Symbol('IJobQueueService');

export interface IJobQueueService {
  /**
   * Retrieves the metadata of a job by its ID
   * @param jobId - The unique identifier of the job
   * @returns Promise resolving to the Job object or null if not found
   */
  getJob(jobId: string): Promise<Job | null>;

  /**
   * Adds a job to the queue
   * @param name - The name of the job
   * @param data - The data associated with the job
   * @returns Promise resolving to the created Job
   */
  addJob(name: JobTypeName, data: JobData): Promise<Job>;
}
