// SPDX-License-Identifier: FSL-1.1-MIT
import { JobQueueService } from '@/datasources/job-queue/job-queue.service';
import { JobQueueShutdownHook } from '@/datasources/job-queue/job-queue.shutdown.hook';
import { EMAIL_QUEUE } from '@/domain/common/jobs.constants';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { EmailConsumer } from '@/modules/email/ses/consumers/email.consumer';
import { EmailQueueService } from '@/modules/email/ses/email-queue.service';
import { SesEmailService } from '@/modules/email/ses/datasources/ses-email.service';
import { IEmailService } from '@/modules/email/ses/domain/interfaces/email-service.interface';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { Queue } from 'bullmq';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: EMAIL_QUEUE,
      useFactory: (configService: IConfigurationService) => ({
        defaultJobOptions: {
          removeOnComplete: configService.get('email.queue.removeOnComplete'),
          removeOnFail: configService.get('email.queue.removeOnFail'),
          backoff: configService.get('email.queue.backoff'),
          attempts: configService.get<number>('email.queue.attempts'),
        },
      }),
      inject: [IConfigurationService],
    }),
  ],
  providers: [
    { provide: IEmailService, useClass: SesEmailService },
    {
      provide: IJobQueueService,
      useFactory: (queue: Queue): IJobQueueService =>
        new JobQueueService(queue),
      inject: [getQueueToken(EMAIL_QUEUE)],
    },
    {
      provide: JobQueueShutdownHook,
      useFactory: (
        queue: Queue,
        logging: ILoggingService,
      ): JobQueueShutdownHook => new JobQueueShutdownHook(queue, logging),
      inject: [getQueueToken(EMAIL_QUEUE), LoggingService],
    },
    EmailConsumer,
    EmailQueueService,
  ],
  exports: [EmailQueueService],
})
export class SesEmailModule {}
