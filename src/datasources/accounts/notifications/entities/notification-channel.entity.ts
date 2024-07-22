import { NotificationChannel as DomainNotificationChannel } from '@/domain/notifications/entities-v2/notification-channel.entity';

export type NotificationChannel = {
  id: number;
  name: DomainNotificationChannel;
};
