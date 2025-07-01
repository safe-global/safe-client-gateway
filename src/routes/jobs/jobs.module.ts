import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from '@/routes/jobs/jobs.controller';
import { JobsService } from '@/routes/jobs/jobs.service';
import { JobQueueModule } from '@/datasources/job-queue/job-queue.module';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Module({
  imports: [
    JobQueueModule,
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
  ],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
