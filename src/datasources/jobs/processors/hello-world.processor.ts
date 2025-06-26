import { Injectable, Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { HelloWorldJobData } from '@/datasources/jobs/jobs.service';
import { JOBS_QUEUE_NAME } from '@/datasources/jobs/jobs.module';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { JobType } from '@/datasources/jobs/types/job-types';

@Injectable()
@Processor(JOBS_QUEUE_NAME)
export class HelloWorldProcessor extends WorkerHost {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super();
  }

  async process(job: Job<HelloWorldJobData>): Promise<void> {
    if (job.name !== JobType.HELLO_WORLD as string) {
      return;
    }

    const data = job.data;

    this.loggingService.info({
      type: LogType.JobEvent,
      source: 'HelloWorldProcessor',
      event: `Processing hello world job: ${data.message}`,
    });

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.loggingService.info({
      type: LogType.JobEvent,
      source: 'HelloWorldProcessor',
      event: `Hello World job completed! Message: ${data.message}, Timestamp: ${data.timestamp}`,
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.loggingService.info({
      type: LogType.JobEvent,
      source: 'HelloWorldProcessor',
      event: `Job ${job.id} completed successfully`,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.loggingService.error({
      type: LogType.JobError,
      source: 'HelloWorldProcessor',
      event: `Job ${job?.id} failed: ${err.message}`,
    });
  }

  @OnWorkerEvent('active')
  onActive(job: Job): void {
    this.loggingService.debug({
      type: LogType.JobEvent,
      source: 'HelloWorldProcessor',
      event: `Job ${job.id} started processing`,
    });
  }
}