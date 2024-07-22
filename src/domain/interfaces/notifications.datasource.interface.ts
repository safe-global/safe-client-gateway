import { UpsertSubscriptionsDto } from '@/datasources/accounts/notifications/entities/upsert-subscriptions.dto.entity';
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
  }): Promise<unknown>;

  getCloudMessagingTokensBySafe(args: {
    chainId: `0x${string}`;
    safeAddress: `0x${string}`;
  }): Promise<Array<string>>;

  deleteSubscription(args: {
    account: `0x${string}`;
    chainId: `0x${string}`;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  deleteDevice(deviceUuid: Uuid): Promise<void>;
}
