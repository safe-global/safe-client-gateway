// SPDX-License-Identifier: FSL-1.1-MIT
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { DefaultJobOptions, Queue } from 'bullmq';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { JobQueueShutdownHook } from '#/datasources/job-queue/job-queue.shutdown.hook';
import { SAFENET_CHECKS_QUEUE } from '#/domain/common/jobs.constants';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { AuthModule } from '#/modules/auth/auth.module';
import { BillingRepositoryModule } from '#/modules/billing/domain/billing-repository.module';
import { FeatureFlagsModule } from '#/modules/chains/feature-flags/feature-flags.module';
import { SafeModule } from '#/modules/safe/safe.module';
import { SafenetChecksConsumer } from '#/modules/safenet/consumers/safenet-checks.consumer';
import { SafenetChecksQueue } from '#/modules/safenet/domain/safenet-checks-queue.service';
import { SafenetChecksController } from '#/modules/safenet/routes/safenet-checks.controller';
import { SafenetChecksService } from '#/modules/safenet/routes/safenet-checks.service';
import { SafenetModule } from '#/modules/safenet/safenet.module';
import { SpacesModule } from '#/modules/spaces/spaces.module';
import { UsersModule } from '#/modules/users/users.module';

// Sponsored-check route and queue; loaded under FF_SAFENET, FF_USERS and FF_BILLING_SERVICE.
@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: SAFENET_CHECKS_QUEUE,
      useFactory: (configuration: IConfigurationService) => ({
        defaultJobOptions:
          configuration.getOrThrow<DefaultJobOptions>('safenet.queue'),
      }),
      inject: [IConfigurationService],
    }),
    SafenetModule,
    AuthModule,
    BillingRepositoryModule,
    FeatureFlagsModule,
    SafeModule,
    SpacesModule,
    UsersModule,
  ],
  controllers: [SafenetChecksController],
  providers: [
    {
      provide: JobQueueShutdownHook,
      useFactory: (
        queue: Queue,
        logging: ILoggingService,
      ): JobQueueShutdownHook => new JobQueueShutdownHook(queue, logging),
      inject: [getQueueToken(SAFENET_CHECKS_QUEUE), LoggingService],
    },
    SafenetChecksConsumer,
    SafenetChecksQueue,
    SafenetChecksService,
  ],
})
export class SafenetChecksModule {}
