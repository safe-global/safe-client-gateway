import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { JobType } from '@/datasources/jobs/types/job-types';
import { JOBS_QUEUE_NAME } from '@/datasources/jobs/jobs.module';

export interface HelloWorldJobData {
  message: string;
  timestamp: number;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly queue: Queue,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async addHelloWorldJob(data: HelloWorldJobData): Promise<Job> {
    this.loggingService.info({
      type: LogType.JobEvent,
      source: 'JobsService',
      event: `Adding hello world job with message: ${data.message}`,
    });

    return this.queue.add(JobType.HELLO_WORLD, data, {
      priority: 1,
      delay: 0,
    });
  }

  async getJobStatus(jobId: string): Promise<Job | null> {
    return this.queue.getJob(jobId);
  }
}
