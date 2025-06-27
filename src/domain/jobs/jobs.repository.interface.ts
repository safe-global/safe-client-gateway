import { Module } from '@nestjs/common';
import { Job } from 'bullmq';
import { JobsModule } from '@/datasources/jobs/jobs.module';
import { JobsRepository } from '@/datasources/jobs/jobs.repository';

export const IJobsRepository = Symbol('IJobsRepository');

export interface IJobsRepository {
  /**
   * Retrieves the status of a job by its ID
   * @param jobId - The unique identifier of the job
   * @returns Promise resolving to the Job object or null if not found
   */
  getJobStatus(jobId: string): Promise<Job | null>;
}

@Module({
  imports: [JobsModule],
  providers: [
    {
      provide: IJobsRepository,
      useClass: JobsRepository,
    },
  ],
  exports: [IJobsRepository],
})
export class JobsRepositoryModule {}
