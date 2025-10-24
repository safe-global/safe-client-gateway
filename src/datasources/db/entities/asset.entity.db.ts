import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_assets_id' })
  id!: number;

  @Index('idx_asset_asset_id', { unique: true })
  @Column({ name: 'asset_id', type: 'varchar', length: 50, unique: true })
  assetId!: string;

  @Column({ type: 'varchar', length: 100 })
  symbol!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'is_canonical', type: 'boolean', default: true })
  isCanonical!: boolean;

  @Column({ name: 'provider_ids', type: 'jsonb' })
  providerIds!: Record<string, string>;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp with time zone',
  })
  updatedAt!: Date;
}
