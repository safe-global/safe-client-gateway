import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { JobType } from '@/datasources/jobs/types/job-types';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';
import { HelloWorldJobData } from '@/domain/jobs/jobs.repository.interface';

@Injectable()
export class JobsRepository {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly queue: Queue,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Adds a hello world job to the queue
   * @param data - The job data containing message and timestamp
   * @returns Promise resolving to the created Job
   */
  public async addHelloWorldJob(data: HelloWorldJobData): Promise<Job> {
    this.loggingService.info({
      type: LogType.JobEvent,
      source: 'JobsRepository',
      event: `Adding hello world job with message: ${data.message}`,
    });

    return this.queue.add(JobType.HELLO_WORLD, data, {
      priority: 1,
      delay: 0,
    });
  }

  /**
   * Retrieves the status of a job by its ID
   * @param jobId - The unique identifier of the job
   * @returns Promise resolving to the Job object or null if not found
   */
  public async getJobStatus(jobId: string): Promise<Job | null> {
    return this.queue.getJob(jobId);
  }
}