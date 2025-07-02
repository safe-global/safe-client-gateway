import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobQueueService } from '@/datasources/job-queue/job-queue.service';
import { JobQueueShutdownHook } from '@/datasources/job-queue/job-queue.shutdown.hook';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';

@Module({
  imports: [
    BullModule.registerQueue({
      name: JOBS_QUEUE_NAME,
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
    { provide: IJobQueueService, useClass: JobQueueService },
    JobQueueShutdownHook,
  ],
  exports: [IJobQueueService, BullModule],
})
export class JobQueueModule {}
