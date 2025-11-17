import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import { notificationTypeBuilder } from '@/modules/notifications/datasources/entities/__tests__/notification-type.entity.db.builder';
import { notificationSubscriptionBuilder } from '@/modules/notifications/datasources/entities/__tests__/notification-subscription.entity.db.builder';
import type { NotificationSubscriptionNotificationType } from '@/modules/notifications/datasources/entities/notification-subscription-notification-type.entity.db';

export function notificationSubscriptionNotificationTypeTypeBuilder(): IBuilder<NotificationSubscriptionNotificationType> {
  return new Builder<NotificationSubscriptionNotificationType>()
    .with('id', faker.number.int())
    .with(
      'notification_subscription',
      notificationSubscriptionBuilder().build(),
    )
    .with('notification_type', notificationTypeBuilder().build());
}
