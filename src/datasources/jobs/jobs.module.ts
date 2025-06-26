import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from '@/datasources/jobs/jobs.service';
import { HelloWorldProcessor } from '@/datasources/jobs/processors/hello-world.processor';
import { IConfigurationService } from '@/config/configuration.service.interface';

export const JOBS_QUEUE_NAME = 'jobs';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [IConfigurationService],
      useFactory: (configurationService: IConfigurationService) => ({
        connection: {
          host: configurationService.getOrThrow<string>('redis.host'),
          port: Number(configurationService.getOrThrow<string>('redis.port')),
          username: configurationService.get<string>('redis.user'),
          password: configurationService.get<string>('redis.pass'),
        },
      }),
    }),
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