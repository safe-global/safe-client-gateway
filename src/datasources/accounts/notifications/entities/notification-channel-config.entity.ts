import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';

export type NotificationChannelConfig = {
  id: number;
  notification_subscription_id: number;
  notification_channel_id: number;
  device_uuid: Uuid;
  cloud_messaging_token: string;
  created_at: Date;
  updated_at: Date;
};
