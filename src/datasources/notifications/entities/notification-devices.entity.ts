import { NotificationSubscription } from '@/datasources/notifications/entities/notification-subscription.entity';
import type { UUID } from 'crypto';
import {
  Check,
  Column,
  Entity,
  Unique,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('push_notification_devices')
@Unique('device_uuid', ['device_uuid'])
@Check('device_type', 'device_type IN ("ANDROID", "IOS", "WEB")')
export class NotificationDevice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'varchar',
    length: 255,
  })
  device_type!: string;

  @Column({ type: 'uuid' })
  device_uuid!: UUID;

  @Column({ type: 'varchar', length: 255 })
  cloud_messaging_token!: string;

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

  @OneToMany(() => NotificationSubscription, (device) => device.id, {
    onDelete: 'CASCADE',
  })
  notification_subscriptions!: NotificationSubscription[];
}
