import type { UpsertSubscriptionsDto } from '@/domain/notifications/v2/entities/upsert-subscriptions.dto.entity';
import type { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import type { UUID } from 'crypto';
import type { Address } from 'viem';

export const INotificationsDatasource = Symbol('INotificationsDatasource');

export interface INotificationsDatasource {
  upsertSubscriptions(args: {
    signerAddress?: Address;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }>;

  getSafeSubscription(args: {
    signerAddress: Address;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<NotificationType>>;

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

  deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  deleteDevice(deviceUuid: UUID): Promise<void>;
}
