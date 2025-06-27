import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IJobsRepository } from '@/domain/jobs/jobs.repository.interface';
import { JobStatusResponseDto } from '@/routes/jobs/entities/job-status.dto';

@Injectable()
export class JobsService {
  constructor(
    @Inject(IJobsRepository)
    private readonly jobsRepository: IJobsRepository,
  ) {}

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
