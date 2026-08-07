// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import type { SubscriptionEntitlement as DomainSubscriptionEntitlement } from '@/modules/entitlements/domain/entities/subscription-entitlement.entity';

@Entity('subscription_entitlements')
@Unique('UQ_SE_subscription_feature', ['subscription', 'feature'])
export class SubscriptionEntitlement implements DomainSubscriptionEntitlement {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_SE_id' })
  public readonly id!: number;

  @Column({ type: 'boolean' })
  public readonly enabled!: boolean;

  // NULL = unlimited (metered only).
  @Column({ type: 'integer', nullable: true })
  public readonly quota!: number | null;

  // Non-boolean tiers (value-typed features, e.g. swap_fee_tier).
  @Column({ type: 'varchar', length: 255, nullable: true })
  public readonly value!: string | null;

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
    () => SpaceSubscription,
    (subscription: SpaceSubscription) => subscription.entitlements,
    {
      onDelete: 'CASCADE',
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'subscription_id',
    foreignKeyConstraintName: 'FK_SE_subscription_id',
  })
  public readonly subscription?: SpaceSubscription;

  @ManyToOne(() => Feature, {
    onDelete: 'RESTRICT',
    nullable: false,
  })
  @JoinColumn({
    name: 'feature_id',
    foreignKeyConstraintName: 'FK_SE_feature_id',
  })
  public readonly feature!: Feature;
}
