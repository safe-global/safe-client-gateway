import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { notificationDeviceBuilder } from '@/datasources/notifications/entities/__tests__/notification-devices.entity.db.builder';
import type { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity.db';
import { faker } from '@faker-js/faker/.';

export function notificationSubscriptionBuilder(): IBuilder<NotificationSubscription> {
  return new Builder<NotificationSubscription>()
    .with('id', faker.number.int())
    .with('chain_id', faker.number.int({ min: 1, max: 100 }).toString())
    .with(
      'safe_address',
      faker.string.hexadecimal({
        length: 32,
      }) as `0x${string}`,
    )
    .with(
      'signer_address',
      faker.string.hexadecimal({
        length: 32,
      }) as `0x${string}`,
    )
    .with('created_at', new Date())
    .with('updated_at', new Date())
    .with('notification_subscription_notification_type', [])
    .with('push_notification_device', notificationDeviceBuilder().build());
}
