// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { NotificationType } from '@/modules/notifications/datasources/entities/notification-type.entity.db';
import type { NotificationSubscription } from '@/modules/notifications/datasources/entities/notification-subscription.entity.db';
import { z } from 'zod';

export const NotificationSubscriptionNotificationTypeSchema = z.object({
  id: z.number(),
});

@Entity('notification_subscription_notification_types')
@Unique(['notification_subscription', 'notification_type'])
export class NotificationSubscriptionNotificationType implements z.infer<
  typeof NotificationSubscriptionNotificationTypeSchema
> {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/modules/notifications/datasources/entities/notification-subscription.entity.db')
        .NotificationSubscription,
    (subscription: NotificationSubscription) => subscription.id,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'notification_subscription_id',
  })
  notification_subscription!: NotificationSubscription;

  @ManyToOne(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/modules/notifications/datasources/entities/notification-type.entity.db')
        .NotificationType,
    (notificationType: NotificationType) =>
      notificationType.notification_subscription_notification_type,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'notification_type_id' })
  notification_type!: NotificationType;
}
