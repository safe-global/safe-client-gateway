import { Injectable, Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HelloWorldJobData } from '@/datasources/jobs/jobs.service';
import { JOBS_QUEUE_NAME } from '@/datasources/jobs/jobs.constants';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { JobType } from '@/datasources/jobs/types/job-types';

@Injectable()
@Processor(JOBS_QUEUE_NAME)
export class HelloWorldProcessor extends WorkerHost {
  private readonly processingDelayMs: number;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    super();
    this.processingDelayMs = parseInt(
      process.env.HELLO_WORLD_JOB_DELAY_MS ?? '1000',
      10,
    );
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

    // Simulate some work (configurable delay for testing/demo purposes)
    await new Promise((resolve) => setTimeout(resolve, this.processingDelayMs));

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
