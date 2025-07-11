import { CSV_EXPORT_QUEUE } from '@/domain/common/entities/jobs.constants';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { CsvExportJobData } from '@/modules/csv-export/entities/csv-export-job-data.entity';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor(CSV_EXPORT_QUEUE)
export class CsvExportConsumer extends WorkerHost {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super();
  }

  process(job: Job<CsvExportJobData>): Promise<void> {
    throw new Error(`Job ${job.name} is not implemented yet.`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: unknown): void {
    this.loggingService.info(`Job ${job.id} completed; returned ${result}`);
  }

  // Fired when a job fails (after all retries)
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.loggingService.error(`Job ${job.id} failed: ${error}`);
  }

  // Fired whenever `process()` calls job.updateProgress()
  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number): void {
    this.loggingService.info(`Job ${job.id} progress: ${progress}%`);
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.loggingService.error(
      `Worker of ${CSV_EXPORT_QUEUE} queue encountered an error: ${error}`,
    );
  }
}
