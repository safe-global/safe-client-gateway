import type { UpsertSubscriptionsDto } from '@/modules/notifications/domain/v2/entities/upsert-subscriptions.dto.entity';
import type { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import type { UUID } from 'crypto';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { NotificationTypeResponseDto } from '@/modules/notifications/routes/v2/entities/notification-type-response.dto.entity';
import type { Address } from 'viem';

export const INotificationsRepositoryV2 = Symbol('INotificationsRepositoryV2');

export interface INotificationsRepositoryV2 {
  enqueueNotification(args: {
    token: string;
    deviceUuid: UUID;
    notification: FirebaseNotification;
  }): Promise<void>;

  upsertSubscriptions(args: {
    authPayload: AuthPayload;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }>;

  getSafeSubscription(args: {
    authPayload: AuthPayload;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<NotificationTypeResponseDto>>;

  getSubscribersBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<
    Array<{
      subscriber: Address | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }>
  >;

  deleteAllSubscriptions(args: {
    subscriptions: Array<{
      chainId: string;
      deviceUuid: UUID;
      safeAddress: Address;
      signerAddress?: Address | null;
    }>;
  }): Promise<void>;

  deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  deleteDevice(deviceUuid: UUID): Promise<void>;
}
