import { NotificationChannelConfig } from '@/datasources/accounts/notifications/entities/notification-channel-config.entity';
import { UpsertSubscriptionsDto } from '@/datasources/accounts/notifications/entities/upsert-subscriptions.dto.entity';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';

export const INotificationsDatasource = Symbol('INotificationsDatasource');

export interface INotificationsDatasource {
  upsertSubscriptions(args: UpsertSubscriptionsDto): Promise<{
    deviceUuid: Uuid;
  }>;

  getSafeSubscription(args: {
    account: `0x${string}`;
    deviceUuid: Uuid;
    chainId: `0x${string}`;
    safeAddress: `0x${string}`;
  }): Promise<Record<NotificationType, boolean>>;

  getCloudMessagingTokensBySafe(args: {
    chainId: `0x${string}`;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationChannelConfig['cloud_messaging_token']>>;

  deleteSubscription(args: {
    account: `0x${string}`;
    chainId: `0x${string}`;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  deleteDevice(deviceUuid: Uuid): Promise<void>;
}
