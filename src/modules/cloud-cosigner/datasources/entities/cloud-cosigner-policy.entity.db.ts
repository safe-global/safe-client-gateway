// SPDX-License-Identifier: FSL-1.1-MIT
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Address } from 'viem';
import { databaseAddressTransformer } from '@/domain/common/transformers/database-address.transformer';
import type { SafeCloudCosignerPolicy as DomainSafeCloudCosignerPolicy } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';
import {
  ADDRESS_LENGTH,
  CHAIN_ID_MAXLENGTH,
  HEX_PREFIX_LENGTH,
} from '@/routes/common/constants';

// Safe addresses are public on-chain identifiers with no user linkage, so
// they are stored in plaintext (unlike the space-scoped Safes).
@Entity('cloud_cosigner_policies')
@Unique('UQ_CCP_chain_id_safe_address', ['chainId', 'safeAddress'])
export class CloudCosignerPolicy implements DomainSafeCloudCosignerPolicy {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_CCP_id' })
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

  @Column({ name: 'value_threshold_usd', type: 'bigint' })
  public readonly valueThresholdUsd!: number;

  @Column({ name: 'review_unknown_contracts', type: 'boolean' })
  public readonly reviewUnknownContracts!: boolean;

  @Column({ type: 'text', nullable: true })
  public readonly instructions!: string | null;

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
