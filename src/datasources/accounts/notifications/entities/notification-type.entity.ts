import { NotificationType as DomainNotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';

export type NotificationType = {
  id: number;
  name: DomainNotificationType;
};
