// SPDX-License-Identifier: FSL-1.1-MIT
import {
  NotificationSubscriptionNotificationTypeSchema,
  type NotificationSubscriptionNotificationType,
} from '@/modules/notifications/datasources/entities/notification-subscription-notification-type.entity.db';
import { NotificationType as NotificationTypeEnum } from '@/modules/notifications/domain/v2/entities/notification.entity';
import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { z } from 'zod';

export const NotificationTypeSchema = z.object({
  id: z.number(),
  name: z.enum(NotificationTypeEnum),
  notification_subscription_notification_type: z.array(
    z.lazy(() => NotificationSubscriptionNotificationTypeSchema),
  ),
});

@Entity('notification_types')
@Unique('name', ['name'])
export class NotificationType implements z.infer<
  typeof NotificationTypeSchema
> {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: NotificationTypeEnum,
  })
  name!: NotificationTypeEnum;

  @OneToMany(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/modules/notifications/datasources/entities/notification-subscription-notification-type.entity.db')
        .NotificationSubscriptionNotificationType,
    (nsnt: NotificationSubscriptionNotificationType) => nsnt.notification_type,
    { onDelete: 'CASCADE' },
  )
  notification_subscription_notification_type!: Array<NotificationSubscriptionNotificationType>;
}
