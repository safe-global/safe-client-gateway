import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsRepository } from '@/datasources/jobs/jobs.repository';
import { HelloWorldProcessor } from '@/datasources/jobs/processors/hello-world.processor';
import { JobsShutdownHook } from '@/datasources/jobs/jobs.shutdown.hook';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';

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
  providers: [JobsRepository, HelloWorldProcessor, JobsShutdownHook],
  exports: [JobsRepository],
})
export class JobsModule {}
