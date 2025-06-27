import { Injectable, Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ZodError } from 'zod';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HelloWorldJobData } from '@/domain/jobs/jobs.repository.interface';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { JobType } from '@/datasources/jobs/types/job-types';
import { HelloWorldJobDataSchema } from '@/datasources/jobs/entities/schemas/hello-world-job-data.schema';
import { asError } from '@/logging/utils';

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
    this.processingDelayMs = this.configurationService.getOrThrow<number>(
      'helloWorldJob.delayMs',
    );
  }

  public async process(job: Job<HelloWorldJobData>): Promise<void> {
    if (job.name !== (JobType.HELLO_WORLD as string)) {
      return;
    }

    try {
      // Validate job data using Zod schema
      const validatedData = HelloWorldJobDataSchema.parse(job.data);

      this.loggingService.info({
        type: LogType.JobEvent,
        source: 'HelloWorldProcessor',
        event: `Processing hello world job: ${validatedData.message}`,
      });

      // Simulate some work (configurable delay for testing/demo purposes)
      await new Promise((resolve) =>
        setTimeout(resolve, this.processingDelayMs),
      );

      this.loggingService.info({
        type: LogType.JobEvent,
        source: 'HelloWorldProcessor',
        event: `Hello World job completed! Message: ${validatedData.message}, Timestamp: ${validatedData.timestamp}`,
      });
    } catch (error) {
      const errorObj = asError(error);

      if (error instanceof ZodError) {
        this.loggingService.error({
          type: LogType.JobError,
          source: 'HelloWorldProcessor',
          event: `Job ${job.id} failed validation: ${errorObj.message}`,
        });
        throw new Error(`Invalid job data: ${errorObj.message}`);
      }

      this.loggingService.error({
        type: LogType.JobError,
        source: 'HelloWorldProcessor',
        event: `Job ${job.id} processing failed: ${errorObj.message}`,
      });
      throw errorObj;
    }
  }

  @OnWorkerEvent('completed')
  public onCompleted(job: Job): void {
    this.loggingService.info({
      type: LogType.JobEvent,
      source: 'HelloWorldProcessor',
      event: `Job ${job.id} completed successfully`,
    });
  }

  @OnWorkerEvent('failed')
  public onFailed(job: Job, err: Error): void {
    this.loggingService.error({
      type: LogType.JobError,
      source: 'HelloWorldProcessor',
      event: `Job ${job?.id} failed: ${err.message}`,
    });
  }

  @OnWorkerEvent('active')
  public onActive(job: Job): void {
    this.loggingService.debug({
      type: LogType.JobEvent,
      source: 'HelloWorldProcessor',
      event: `Job ${job.id} started processing`,
    });
  }
}
