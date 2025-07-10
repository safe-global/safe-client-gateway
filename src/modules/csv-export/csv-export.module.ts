import { CsvExportService } from '@/modules/csv-export/csv-export.service';
import { JobQueueService } from '@/datasources/job-queue/job-queue.service';
import { JobQueueShutdownHook } from '@/datasources/job-queue/job-queue.shutdown.hook';
import { CSV_EXPORT_QUEUE } from '@/domain/common/entities/jobs.constants';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CSV_EXPORT_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        attempts: 3,
      },
    }),
  ],
  providers: [
    CsvExportService,
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
  ],
  exports: [CsvExportService, BullModule],
})
export class CsvExportModule {}
