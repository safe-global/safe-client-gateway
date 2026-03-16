// SPDX-License-Identifier: FSL-1.1-MIT
import type { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import type {
  JobData,
  JobResponse,
} from '@/datasources/job-queue/types/job-types';
import type { Event } from '@/modules/hooks/routes/entities/event.entity';
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
