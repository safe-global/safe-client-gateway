// SPDX-License-Identifier: FSL-1.1-MIT
import {
  PUSH_NOTIFICATION_QUEUE,
  PUSH_NOTIFICATION_WORKER_CONCURRENCY,
} from '@/domain/common/jobs.constants';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  JobType,
  type JobTypeName,
} from '@/datasources/job-queue/types/job-types';
import { PushNotificationService } from '@/modules/notifications/domain/push/push-notification.service';
import type {
  PushNotificationEventJobData,
  PushNotificationDeliveryJobData,
  PushNotificationJobResponse,
  PushNotificationJob,
  JobMetadata,
} from '@/modules/notifications/domain/push/entities/push-notification-job-data.entity';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor(PUSH_NOTIFICATION_QUEUE, {
  concurrency: PUSH_NOTIFICATION_WORKER_CONCURRENCY,
})
export class PushNotificationConsumer extends WorkerHost {
  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly pushNotificationService: PushNotificationService,
  ) {
    super();
  }

  async process(
    job: PushNotificationJob,
  ): Promise<PushNotificationJobResponse | number> {
    const jobName = job.name as JobTypeName;
    switch (jobName) {
      case JobType.PUSH_NOTIFICATION_EVENT:
        return this.pushNotificationService.processEvent(
          (job as Job<PushNotificationEventJobData>).data.event,
        );
      case JobType.PUSH_NOTIFICATION_DELIVERY:
        return this.pushNotificationService.processDelivery(
          (job as Job<PushNotificationDeliveryJobData>).data,
        );
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: PushNotificationJob): void {
    const metadata = this.getJobMetadata(job);
    this.loggingService.debug({
      type: LogType.JobEvent,
      source: 'PushNotificationConsumer',
      event: `Job ${job.id} completed`,
      ...metadata,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: PushNotificationJob, error: Error): void {
    const metadata = this.getJobMetadata(job);
    this.loggingService.error({
      // if deviceUuid is present, it's a delivery job
      type: metadata.deviceUuid ? LogType.NotificationError : LogType.JobError,
      source: 'PushNotificationConsumer',
      event: `Job ${job.id} failed. ${error}`,
      ...metadata,
    });
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.loggingService.error({
      type: LogType.JobError,
      source: 'PushNotificationConsumer',
      event: `Worker encountered an error: ${asError(error).message}`,
    });
  }

  /**
   * Extracts delivery-specific metadata from a job for structured logging.
   * Returns enriched fields for delivery jobs, base fields for event jobs.
   */
  private getJobMetadata(job: PushNotificationJob): JobMetadata {
    const deliveryData =
      (job.name as JobTypeName) === JobType.PUSH_NOTIFICATION_DELIVERY &&
      'chainId' in job.data
        ? job.data
        : null;

    return {
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      ...(deliveryData && {
        chainId: deliveryData.chainId,
        safeAddress: deliveryData.safeAddress,
        notificationType: deliveryData.notificationType,
        deviceUuid: deliveryData.deviceUuid,
      }),
    };
  }
}
