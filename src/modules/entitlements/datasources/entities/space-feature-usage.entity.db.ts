// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import type { SpaceFeatureUsage as DomainSpaceFeatureUsage } from '@/modules/entitlements/domain/entities/space-feature-usage.entity';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';

// Event-type consumption counters only (e.g. gas-sponsored transactions).
// Stock counts (seats, members) are live COUNTs over their own tables.
// Keyed by period start: a new cycle reads/creates a different row, so quota
// resets are implicit and per-period history is preserved. Usage hangs off
// the SPACE (not the subscription) so it survives plan changes and exists
// for free workspaces.
@Entity('space_feature_usage')
@Unique('UQ_SFU_space_feature_period', ['space', 'feature', 'periodStart'])
export class SpaceFeatureUsage implements DomainSpaceFeatureUsage {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_SFU_id' })
  public readonly id!: number;

  @Column({ name: 'period_start', type: 'timestamp with time zone' })
  public readonly periodStart!: Date;

  @Column({ type: 'integer', default: 0 })
  public readonly used!: number;

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
    foreignKeyConstraintName: 'FK_SFU_space_id',
  })
  public readonly space?: Space;

  @Index('IDX_SFU_feature_id')
  @ManyToOne(() => Feature, {
    onDelete: 'RESTRICT',
    nullable: false,
  })
  @JoinColumn({
    name: 'feature_id',
    foreignKeyConstraintName: 'FK_SFU_feature_id',
  })
  public readonly feature?: Feature;
}
