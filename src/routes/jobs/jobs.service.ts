import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  IJobsRepository,
  HelloWorldJobData,
} from '@/domain/jobs/jobs.repository.interface';
import { JobStatusResponseDto } from '@/routes/jobs/entities/job-status.dto';

@Injectable()
export class JobsService {
  constructor(
    @Inject(IJobsRepository)
    private readonly jobsRepository: IJobsRepository,
  ) {}

  /**
   * Adds a hello world job to the queue
   * @param data - The job data containing message and timestamp
   * @returns Promise resolving to the created Job
   */
  public async addHelloWorldJob(data: HelloWorldJobData): Promise<Job> {
    return this.jobsRepository.addHelloWorldJob(data);
  }

  /**
   * Retrieves the status of a job by its ID
   * @param jobId - The unique identifier of the job
   * @returns Promise resolving to the job status response
   * @throws NotFoundException when job is not found
   */
  public async getJobStatus(jobId: string): Promise<JobStatusResponseDto> {
    const job = await this.jobsRepository.getJobStatus(jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data as Record<string, unknown>,
      progress: job.progress as
        | number
        | string
        | Record<string, unknown>
        | boolean
        | undefined,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }
}