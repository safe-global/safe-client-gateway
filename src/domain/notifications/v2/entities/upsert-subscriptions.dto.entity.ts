import { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import { Uuid } from '@/domain/notifications/v2/entities/uuid.entity';

export type UpsertSubscriptionsDto = {
  cloudMessagingToken: string;
  safes: Array<{
    chainId: string;
    address: `0x${string}`;
    notificationTypes: Array<NotificationType>;
  }>;
  deviceType: DeviceType;
  deviceUuid?: Uuid;
};
