import { NotificationDevice } from '@/datasources/notifications/entities/notification-devices.entity';
import { type NotificationSubscriptionNotificationType } from '@/datasources/notifications/entities/notification-subscription-notification-type.entity';
import {
  Column,
  Entity,
  Unique,
  ManyToOne,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';

@Entity('notification_subscriptions')
@Unique([
  'chain_id',
  'safe_address',
  'push_notification_device',
  'signer_address',
])
export class NotificationSubscription {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => NotificationDevice, (device) => device.id, {
    onDelete: 'CASCADE',
  })
  push_notification_device!: NotificationDevice;

  @Column({
    type: 'varchar',
    length: 255,
  })
  chain_id!: string;

  @Column({
    type: 'varchar',
    length: 42,
  })
  safe_address!: string;

  @Column({
    type: 'varchar',
    nullable: true,
    length: 42,
  })
  signer_address!: string | null;

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
    () => NotificationSubscription,
    (notificationSubscription) => notificationSubscription.id,
  )
  notification_subscription_notification_type!: NotificationSubscriptionNotificationType[];
}
