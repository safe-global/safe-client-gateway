// SPDX-License-Identifier: FSL-1.1-MIT
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import type { NotificationDevice } from '@/modules/notifications/datasources/entities/notification-devices.entity.db';
import {
  NotificationSubscriptionNotificationTypeSchema,
  type NotificationSubscriptionNotificationType,
} from '@/modules/notifications/datasources/entities/notification-subscription-notification-type.entity.db';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import {
  Column,
  Entity,
  Unique,
  ManyToOne,
  PrimaryGeneratedColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { type Address, getAddress } from 'viem';
import { z } from 'zod';

export const NotificationSubscriptionSchema = RowSchema.extend({
  chain_id: NumericStringSchema,
  safe_address: AddressSchema,
  signer_address: AddressSchema.nullable(),
  notification_subscription_notification_type: z.array(
    z.lazy(() => NotificationSubscriptionNotificationTypeSchema),
  ),
});

@Entity('notification_subscriptions')
@Unique([
  'chain_id',
  'safe_address',
  'push_notification_device',
  'signer_address',
])
export class NotificationSubscription implements z.infer<
  typeof NotificationSubscriptionSchema
> {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(
    () => require('@/modules/notifications/datasources/entities/notification-devices.entity.db').NotificationDevice,
    (device: NotificationDevice) => device.id,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'push_notification_device_id' })
  push_notification_device!: NotificationDevice;

  @Column({
    type: 'varchar',
    length: 255,
  })
  chain_id!: string;

  @Column({
    type: 'varchar',
    length: 42,
    transformer: {
      from(value: string): Address {
        return getAddress(value);
      },
      to(value: string): Address {
        return getAddress(value);
      },
    },
  })
  safe_address!: Address;

  @Column({
    type: 'varchar',
    nullable: true,
    length: 42,
    transformer: {
      from(value?: string): string | null {
        return value ? getAddress(value) : null;
      },
      to(value?: string): string | null {
        return value ? getAddress(value) : null;
      },
    },
  })
  signer_address!: Address | null;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at!: Date;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at!: Date;

  @OneToMany(
    () => require('@/modules/notifications/datasources/entities/notification-subscription-notification-type.entity.db').NotificationSubscriptionNotificationType,
    (nsnt: NotificationSubscriptionNotificationType) => nsnt.id,
  )
  notification_subscription_notification_type!: Array<NotificationSubscriptionNotificationType>;
}
