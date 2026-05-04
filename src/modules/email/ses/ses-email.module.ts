// SPDX-License-Identifier: FSL-1.1-MIT
import { JobQueueService } from '@/datasources/job-queue/job-queue.service';
import { JobQueueShutdownHook } from '@/datasources/job-queue/job-queue.shutdown.hook';
import { SES_EMAIL_QUEUE } from '@/domain/common/jobs.constants';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { EmailConsumer } from '@/modules/email/ses/consumers/email.consumer';
import { SesEmailQueueService } from '@/modules/email/ses/ses-email-queue.service';
import { AwsSesEmailService } from '@/modules/email/ses/datasources/aws-ses-email.service';
import { IEmailService } from '@/modules/email/ses/domain/interfaces/email-service.interface';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { Queue } from 'bullmq';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: SES_EMAIL_QUEUE,
      useFactory: (configService: IConfigurationService) => ({
        defaultJobOptions: {
          removeOnComplete: configService.get(
            'email.ses.queue.removeOnComplete',
          ),
          removeOnFail: configService.get('email.ses.queue.removeOnFail'),
          backoff: configService.get('email.ses.queue.backoff'),
          attempts: configService.get<number>('email.ses.queue.attempts'),
        },
      }),
      inject: [IConfigurationService],
    }),
  ],
  providers: [
    { provide: IEmailService, useClass: AwsSesEmailService },
    {
      provide: IJobQueueService,
      useFactory: (queue: Queue): IJobQueueService =>
        new JobQueueService(queue),
      inject: [getQueueToken(SES_EMAIL_QUEUE)],
    },
    {
      provide: JobQueueShutdownHook,
      useFactory: (
        queue: Queue,
        logging: ILoggingService,
      ): JobQueueShutdownHook => new JobQueueShutdownHook(queue, logging),
      inject: [getQueueToken(SES_EMAIL_QUEUE), LoggingService],
    },
    EmailConsumer,
    SesEmailQueueService,
  ],
  exports: [SesEmailQueueService],
})
export class SesEmailModule {}
