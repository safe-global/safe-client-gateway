// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { SubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionStatuses } from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import type { SpaceSubscription as DomainSpaceSubscription } from '@/modules/entitlements/domain/entities/space-subscription.entity';
import { ACTIVE_SUBSCRIPTION_STATUSES } from '@/modules/entitlements/domain/entitlements.constants';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';

const toSqlList = (values: ReadonlyArray<string>): string =>
  values.map((value) => `'${value}'`).join(',');

@Entity('subscriptions')
// "1 active per space": only one row may hold the active slot; terminal rows
// (canceled, incomplete*) stay as history.
@Index('UQ_subscriptions_active_space', ['space'], {
  unique: true,
  where: `status IN (${toSqlList(ACTIVE_SUBSCRIPTION_STATUSES)})`,
})
@Check(
  'CHK_subscriptions_status',
  `"status" IN (${toSqlList(SubscriptionStatuses)})`,
)
@Unique('UQ_subscriptions_upstream_id', ['upstreamSubscriptionId'])
export class SpaceSubscription implements DomainSpaceSubscription {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_subscriptions_id' })
  public readonly id!: number;

  @Column({
    name: 'upstream_subscription_id',
    type: 'varchar',
    length: 255,
  })
  public readonly upstreamSubscriptionId!: string;

  // Stripe statuses arrive as strings from the billing service; stored
  // verbatim (with a CHECK constraint) rather than as a numeric enum.
  @Column({ type: 'varchar', length: 32 })
  public readonly status!: SubscriptionStatus;

  @Column({ name: 'plan_id', type: 'varchar', length: 255 })
  public readonly planId!: string;

  @Column({ name: 'plan_name', type: 'varchar', length: 255, nullable: true })
  public readonly planName!: string | null;

  // Anchor for quota resets; advanced by renewal webhooks.
  @Column({
    name: 'current_period_start',
    type: 'timestamp with time zone',
    nullable: true,
  })
  public readonly currentPeriodStart!: Date | null;

  @Column({
    name: 'current_period_end',
    type: 'timestamp with time zone',
    nullable: true,
  })
  public readonly currentPeriodEnd!: Date | null;

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

  @Index('IDX_subscriptions_space_id')
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
    foreignKeyConstraintName: 'FK_subscriptions_space_id',
  })
  public readonly space?: Space;

  @OneToMany(
    () => SubscriptionEntitlement,
    (entitlement: SubscriptionEntitlement) => entitlement.subscription,
    {
      cascade: ['insert'],
    },
  )
  public readonly entitlements?: Array<SubscriptionEntitlement>;
}
