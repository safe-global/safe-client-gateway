import { UpsertSubscriptionsDto } from '@/datasources/notifications/entities/upsert-subscriptions.dto.entity';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';

export const INotificationsDatasource = Symbol('INotificationsDatasource');

export interface INotificationsDatasource {
  upsertSubscriptions(args: {
    signerAddress: `0x${string}`;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: Uuid;
  }>;

  getSafeSubscription(args: {
    signerAddress: `0x${string}`;
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>>;

  getSubscribersWithTokensBySafe(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    signerAddress: `0x${string}`;
  }): Promise<
    Array<{
      subscriber: `0x${string}`;
      cloudMessagingToken: string;
    }>
  >;

  deleteSubscription(args: {
    deviceUuid: Uuid;
    chainId: string;
    safeAddress: `0x${string}`;
    signerAddress: `0x${string}`;
  }): Promise<void>;

  deleteDevice(deviceUuid: Uuid): Promise<void>;
}
