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
import { SafenetChecksConsumer } from '#/modules/safenet/consumers/safenet-checks.consumer';
import { SafenetChecksQueue } from '#/modules/safenet/domain/safenet-checks-queue.service';
import { SafenetModule } from '#/modules/safenet/safenet.module';

/** The queue of sponsored checks; its consumer proposes each job through the payer. */
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
  ],
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
  ],
})
export class SafenetChecksModule {}
