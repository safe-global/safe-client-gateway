// SPDX-License-Identifier: FSL-1.1-MIT
import { JobQueueService } from '@/datasources/job-queue/job-queue.service';
import { JobQueueShutdownHook } from '@/datasources/job-queue/job-queue.shutdown.hook';
import { PUSH_NOTIFICATION_QUEUE } from '@/domain/common/jobs.constants';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PushNotificationConsumer } from '@/modules/notifications/domain/push/consumers/push-notification.consumer';
import { PushNotificationService } from '@/modules/notifications/domain/push/push-notification.service';
import { IPushNotificationService } from '@/modules/notifications/domain/push/push-notification.service.interface';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { MessagesModule } from '@/modules/messages/messages.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { Queue } from 'bullmq';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: PUSH_NOTIFICATION_QUEUE,
      useFactory: (configService: IConfigurationService) => ({
        defaultJobOptions: {
          removeOnComplete: configService.get(
            'pushNotifications.queue.removeOnComplete',
          ),
          removeOnFail: configService.get(
            'pushNotifications.queue.removeOnFail',
          ),
          backoff: configService.get('pushNotifications.queue.backoff'),
          attempts: configService.get<number>(
            'pushNotifications.queue.attempts',
          ),
        },
      }),
      inject: [IConfigurationService],
    }),
    DelegatesV2RepositoryModule,
    MessagesModule,
    SafeRepositoryModule,
    NotificationsRepositoryV2Module,
  ],
  providers: [
    {
      provide: IJobQueueService,
      useFactory: (queue: Queue): IJobQueueService =>
        new JobQueueService(queue),
      inject: [getQueueToken(PUSH_NOTIFICATION_QUEUE)],
    },
    {
      provide: JobQueueShutdownHook,
      useFactory: (
        queue: Queue,
        logging: ILoggingService,
      ): JobQueueShutdownHook => new JobQueueShutdownHook(queue, logging),
      inject: [getQueueToken(PUSH_NOTIFICATION_QUEUE), LoggingService],
    },
    PushNotificationConsumer,
    PushNotificationService,
    {
      provide: IPushNotificationService,
      useExisting: PushNotificationService,
    },
  ],
  exports: [IPushNotificationService],
})
export class PushNotificationModule {}
