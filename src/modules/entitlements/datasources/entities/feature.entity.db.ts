// SPDX-License-Identifier: FSL-1.1-MIT
import { Check, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { toSqlList } from '@/datasources/db/v2/entities/sql.utils';
import type { Feature as DomainFeature } from '@/modules/entitlements/domain/entities/feature.entity';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';

@Entity('features')
@Unique('UQ_features_key', ['key'])
@Check(
  'CHK_features_type',
  `"type" IN (${toSqlList(Object.values(FeatureType))})`,
)
export class Feature implements DomainFeature {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_features_id' })
  public readonly id!: number;

  @Column({ type: 'varchar', length: 64 })
  public readonly key!: string;

  @Column({ type: 'varchar', length: 16 })
  public readonly type!: FeatureType;

  @Column({ type: 'text', default: '' })
  public readonly description!: string;

  @Column({ name: 'free_enabled', type: 'boolean', default: false })
  public readonly freeEnabled!: boolean;

  // NULL = unlimited (metered only).
  @Column({ name: 'free_quota', type: 'integer', nullable: true })
  public readonly freeQuota!: number | null;

  // Free tier value (value-typed features only).
  @Column({ name: 'free_value', type: 'varchar', length: 255, nullable: true })
  public readonly freeValue!: string | null;

  // Free usage window in DAYS (event-metered only), anchored at the
  // workspace's creation date. NULL for stock-type metered features.
  @Column({ name: 'free_period', type: 'integer', nullable: true })
  public readonly freePeriod!: number | null;

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
}
