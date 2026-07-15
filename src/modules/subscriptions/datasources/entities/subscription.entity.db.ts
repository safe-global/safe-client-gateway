// SPDX-License-Identifier: FSL-1.1-MIT
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { SubscriptionMetadata } from '@/modules/subscriptions/domain/entities/subscription-metadata.entity';
import type {
  Subscription as DomainSubscription,
  SubscriptionStatus,
} from '@/modules/subscriptions/domain/entities/subscription.entity';

@Entity('subscriptions')
export class Subscription implements DomainSubscription {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  public readonly id!: string;

  @Column({ type: 'varchar', length: 16 })
  public status!: SubscriptionStatus;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  public metadata!: SubscriptionMetadata;

  @Column({ name: 'last_event_id', type: 'varchar', length: 255 })
  public lastEventId!: string;

  @Column({
    name: 'last_event_occurred_at',
    type: 'timestamp with time zone',
  })
  public lastEventOccurredAt!: Date;

  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  public readonly createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  public readonly updatedAt!: Date;

  @ManyToOne(
    () => Space,
    (space: Space) => space.id,
    {
      onDelete: 'CASCADE',
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'space_id',
    foreignKeyConstraintName: 'FK_SUB_space_id',
  })
  public readonly space?: Space;
}
