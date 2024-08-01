import { UpsertSubscriptionsDto } from '@/routes/notifications/entities/upsert-subscriptions.dto.entity';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';
import { UUID } from 'crypto';

export const INotificationsDatasource = Symbol('INotificationsDatasource');

export interface INotificationsDatasource {
  upsertSubscriptions(args: {
    signerAddress?: `0x${string}`;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }>;

  getSafeSubscription(args: {
    signerAddress: `0x${string}`;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>>;

  getSubscribersBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}` | null;
      deviceUuid: UUID;
      cloudMessagingToken: string;
    }>
  >;

  deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  deleteDevice(deviceUuid: UUID): Promise<void>;
}
