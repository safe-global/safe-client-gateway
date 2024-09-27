import { Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { NotificationType } from '@/datasources/notifications/entities/notification-type.entity';
import { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity';

@Entity('notification_subscription_notification_types')
@Unique(['notification_subscription', 'notification_type'])
export class NotificationSubscriptionNotificationType {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(
    () => NotificationSubscription,
    (subscription) => subscription.id,
    { onDelete: 'CASCADE' },
  )
  notification_subscription!: NotificationSubscription;

  @ManyToOne(() => NotificationType, (type) => type.id, { onDelete: 'CASCADE' })
  notification_type!: NotificationType;
}
