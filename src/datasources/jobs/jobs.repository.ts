import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';

@Injectable()
export class JobsRepository {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly queue: Queue,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Retrieves the status of a job by its ID
   * @param jobId - The unique identifier of the job
   * @returns Promise resolving to the Job object or null if not found
   */
  public async getJobStatus(jobId: string): Promise<Job | null> {
    return this.queue.getJob(jobId);
  }
}
