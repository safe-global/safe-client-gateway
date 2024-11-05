import type { DeviceType } from '@/domain/notifications/v2/entities/device-type.entity';
import type { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import type { UUID } from 'crypto';

export type UpsertSubscriptionsDto = {
  cloudMessagingToken: string;
  safes: Array<{
    chainId: string;
    address: `0x${string}`;
    notificationTypes: Array<NotificationType>;
  }>;
  deviceType: DeviceType;
  deviceUuid?: UUID;
};
