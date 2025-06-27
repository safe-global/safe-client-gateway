import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from '@/routes/jobs/jobs.controller';
import { JobsService } from '@/routes/jobs/jobs.service';
import { JobsRepositoryModule } from '@/domain/jobs/jobs.repository.interface';
import { JobsModule } from '@/datasources/jobs/jobs.module';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Module({
  imports: [
    JobsRepositoryModule,
    // BullMQ configuration
    BullModule.forRootAsync({
      inject: [IConfigurationService],
      useFactory: (configurationService: IConfigurationService) => ({
        connection: {
          host: configurationService.getOrThrow<string>('redis.host'),
          port: Number(
            configurationService.getOrThrow<string>('redis.port'),
          ),
          username: configurationService.get<string>('redis.user'),
          password: configurationService.get<string>('redis.pass'),
        },
      }),
    }),
    // Import datasource module
    JobsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsRouteModule {}
