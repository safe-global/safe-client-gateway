import { DeviceType } from '@/domain/notifications/entities-v2/device-type.entity';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';

// TODO: Move to domain
export type UpsertSubscriptionsDto = {
  account: `0x${string}`;
  cloudMessagingToken: string;
  safes: Array<{
    chainId: string;
    address: `0x${string}`;
    notificationTypes: Array<NotificationType>;
  }>;
  deviceType: DeviceType;
  deviceUuid?: Uuid;
};
