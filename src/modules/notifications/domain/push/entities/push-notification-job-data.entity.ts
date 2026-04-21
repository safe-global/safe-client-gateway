// SPDX-License-Identifier: FSL-1.1-MIT
import type { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import type {
  JobData,
  JobResponse,
} from '@/datasources/job-queue/types/job-types';
import type { Event } from '@/modules/hooks/routes/entities/event.entity';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { Job } from 'bullmq';
import type { Address } from 'viem';
import type { UUID } from 'crypto';

export interface PushNotificationEventJobData extends JobData {
  event: Event;
}

export interface PushNotificationDeliveryJobData extends JobData {
  token: string;
  deviceUuid: UUID;
  notification: FirebaseNotification;
  chainId: string;
  safeAddress: string;
  notificationType: string;
}

export interface PushNotificationJobResponse extends JobResponse {
  delivered: boolean;
}

export type PushNotificationJob = Job<
  PushNotificationEventJobData | PushNotificationDeliveryJobData
>;

export type ResolvedSubscriber = {
  subscriber: Address | null;
  deviceUuid: UUID;
  cloudMessagingToken: string;
  delegates?: Array<Delegate>;
};

export type JobMetadata = {
  jobName: string;
  attemptsMade: number;
  chainId?: string;
  safeAddress?: string;
  notificationType?: string;
  deviceUuid?: string;
};
