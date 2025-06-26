import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from '@/datasources/jobs/jobs.service';
import { HelloWorldProcessor } from '@/datasources/jobs/processors/hello-world.processor';

export const JOBS_QUEUE_NAME = 'jobs';

@Global()
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
  providers: [JobsService, HelloWorldProcessor],
  exports: [JobsService],
})
export class JobsModule {}
