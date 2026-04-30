// SPDX-License-Identifier: FSL-1.1-MIT
import {
  SES_EMAIL_QUEUE,
  SES_EMAIL_WORKER_CONCURRENCY,
} from '@/domain/common/jobs.constants';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { IEmailService } from '@/modules/email/ses/domain/interfaces/email-service.interface';
import { PermanentEmailError } from '@/modules/email/ses/domain/errors/email.errors';
import type { SendEmailJobData } from '@/modules/email/ses/domain/entities/email-job-data.entity';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';

@Processor(SES_EMAIL_QUEUE, { concurrency: SES_EMAIL_WORKER_CONCURRENCY })
export class EmailConsumer extends WorkerHost {
  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IEmailService)
    private readonly emailService: IEmailService,
  ) {
    super();
  }

  async process(job: Job<SendEmailJobData>): Promise<void> {
    this.loggingService.debug({
      type: LogType.JobEvent,
      source: 'EmailConsumer',
      event: `Processing email job ${job.id}`,
      attemptsMade: job.attemptsMade,
    });

    try {
      await this.emailService.send({
        to: job.data.to,
        subject: job.data.subject,
        htmlBody: job.data.htmlBody,
        textBody: job.data.textBody,
      });
    } catch (error) {
      if (error instanceof PermanentEmailError) {
        this.loggingService.error({
          type: LogType.JobError,
          source: 'EmailConsumer',
          event: `Permanent email delivery failure. Job ${job.id}: ${error.message}`,
        });
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.loggingService.debug({
      type: LogType.JobEvent,
      source: 'EmailConsumer',
      event: `Job ${job.id} completed`,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.loggingService.error({
      type: LogType.JobError,
      source: 'EmailConsumer',
      event: `Job ${job.id} failed. ${asError(error).message}`,
    });
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.loggingService.error({
      type: LogType.JobError,
      source: 'EmailConsumer',
      event: `Worker encountered an error: ${asError(error).message}`,
    });
  }
}
