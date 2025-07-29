import { JobQueueService } from '@/datasources/job-queue/job-queue.service';
import { JobQueueShutdownHook } from '@/datasources/job-queue/job-queue.shutdown.hook';
import { CSV_EXPORT_QUEUE } from '@/domain/common/entities/jobs.constants';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CsvExportConsumer } from '@/modules/csv-export/v1/consumers/csv-export.consumer';
import { CsvExportController } from '@/modules/csv-export/v1/csv-export.controller';
import { CsvModule } from '@/modules/csv-export/csv-utils/csv.module';
import { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import { ExportApiManagerModule } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import { CloudStorageModule } from '@/datasources/storage/cloud-storage.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CSV_EXPORT_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { age: 86400, count: 1000 }, // 24 hours or last 1000
        removeOnFail: { age: 43200, count: 100 }, // 12 hours or last 1000
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        attempts: 3,
      },
    }),
    ExportApiManagerModule,
    CloudStorageModule,
    CsvModule,
  ],
  controllers: [CsvExportController],
  providers: [
    {
      provide: IJobQueueService,
      useFactory: (queue: Queue): IJobQueueService =>
        new JobQueueService(queue),
      inject: [getQueueToken(CSV_EXPORT_QUEUE)],
    },
    {
      provide: JobQueueShutdownHook,
      useFactory: (
        queue: Queue,
        logging: ILoggingService,
      ): JobQueueShutdownHook => new JobQueueShutdownHook(queue, logging),
      inject: [getQueueToken(CSV_EXPORT_QUEUE), LoggingService],
    },
    CsvExportConsumer,
    CsvExportService,
  ],
  exports: [CsvExportService, BullModule],
})
export class CsvExportModule {}
