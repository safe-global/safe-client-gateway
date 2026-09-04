// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Address, Hex } from 'viem';
import { toSqlList } from '@/datasources/db/v2/entities/sql.utils';
import { databaseAddressTransformer } from '@/domain/common/transformers/database-address.transformer';
import {
  type CloudCosignerReview as DomainCloudCosignerReview,
  type PolicyRule,
  ReviewMode,
  ReviewStatus,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';
import {
  ADDRESS_LENGTH,
  CHAIN_ID_MAXLENGTH,
  HEX_PREFIX_LENGTH,
} from '@/routes/common/constants';

const HASH_HEX_LENGTH = 64;
const SIGNATURE_HEX_LENGTH = 130;
const STATUS_MAXLENGTH = 16;
const MODE_MAXLENGTH = 8;
const MODEL_MAXLENGTH = 64;

@Entity('cloud_cosigner_reviews')
@Unique('UQ_CCR_chain_id_safe_tx_hash', ['chainId', 'safeTxHash'])
@Index('IDX_CCR_chain_id_safe_address', ['chainId', 'safeAddress'])
@Check(
  'CHK_CCR_status',
  `"status" IN (${toSqlList(Object.values(ReviewStatus))})`,
)
@Check(
  'CHK_CCR_mode',
  `"mode" IS NULL OR "mode" IN (${toSqlList(Object.values(ReviewMode))})`,
)
export class CloudCosignerReview implements DomainCloudCosignerReview {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_CCR_id' })
  public readonly id!: number;

  @Column({ name: 'chain_id', type: 'varchar', length: CHAIN_ID_MAXLENGTH })
  public readonly chainId!: string;

  @Column({
    name: 'safe_address',
    type: 'varchar',
    length: HEX_PREFIX_LENGTH + ADDRESS_LENGTH,
    transformer: databaseAddressTransformer,
  })
  public readonly safeAddress!: Address;

  @Column({
    name: 'safe_tx_hash',
    type: 'varchar',
    length: HEX_PREFIX_LENGTH + HASH_HEX_LENGTH,
  })
  public readonly safeTxHash!: Hex;

  @Column({ type: 'varchar', length: STATUS_MAXLENGTH })
  public readonly status!: ReviewStatus;

  @Column({ type: 'varchar', length: MODE_MAXLENGTH, nullable: true })
  public readonly mode!: ReviewMode | null;

  @Column({ name: 'triggered_rules', type: 'jsonb', default: '[]' })
  public readonly triggeredRules!: Array<PolicyRule>;

  @Column({ type: 'text', nullable: true })
  public readonly summary!: string | null;

  @Column({ name: 'risk_flags', type: 'jsonb', default: '[]' })
  public readonly riskFlags!: Array<string>;

  @Column({ type: 'varchar', length: MODEL_MAXLENGTH, nullable: true })
  public readonly model!: string | null;

  @Column({
    type: 'varchar',
    length: HEX_PREFIX_LENGTH + SIGNATURE_HEX_LENGTH,
    nullable: true,
  })
  public readonly signature!: Hex | null;

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
