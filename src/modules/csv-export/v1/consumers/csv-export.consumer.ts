import { CSV_EXPORT_QUEUE } from '@/domain/common/entities/jobs.constants';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import {
  CsvExportJobData,
  CsvExportJobResponse,
} from '@/modules/csv-export/v1/entities/csv-export-job-data.entity';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor(CSV_EXPORT_QUEUE)
export class CsvExportConsumer extends WorkerHost {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject() private readonly csvExportService: CsvExportService,
  ) {
    super();
  }

  async process(
    job: Job<CsvExportJobData, CsvExportJobResponse>,
  ): Promise<CsvExportJobResponse> {
    this.loggingService.info({
      type: LogType.JobEvent,
      source: 'CsvExportConsumer',
      event: `Received job ${job.id}, start processing`,
    });

    const {
      chainId,
      safeAddress,
      timestamp,
      executionDateGte,
      executionDateLte,
      limit,
      offset,
    } = job.data;

    const signedUrl = await this.csvExportService.export(
      {
        chainId,
        safeAddress,
        timestamp,
        executionDateGte,
        executionDateLte,
        limit,
        offset,
      },
      async (progress: number) => {
        await job.updateProgress(progress);
      },
    );

    return { downloadUrl: signedUrl };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.loggingService.info({
      type: LogType.JobEvent,
      source: 'CsvExportConsumer',
      event: `Job ${job.id} completed`,
    });
  }

  // Fired when a job fails after all retries
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.loggingService.error({
      type: LogType.JobError,
      source: 'CsvExportConsumer',
      event: `Job ${job.id} failed: ${error}`,
    });
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number): void {
    this.loggingService.info({
      type: LogType.JobEvent,
      source: 'CsvExportConsumer',
      event: `Job ${job.id} progress: ${progress}%`,
    });
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.loggingService.error({
      type: LogType.JobError,
      source: 'CsvExportConsumer',
      event: `Worker encountered an error: ${error}`,
    });
  }
}
