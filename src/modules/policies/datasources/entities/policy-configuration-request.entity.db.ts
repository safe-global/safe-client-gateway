// SPDX-License-Identifier: FSL-1.1-MIT
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Address, Hex } from 'viem';
import { databaseAddressTransformer } from '@/domain/common/transformers/database-address.transformer';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';

/**
 * The `Configuration[]` behind a delayed configuration request, kept off-chain
 * because `requestConfiguration(bytes32 root)` publishes only its hash.
 *
 * Rows are immutable: a different configuration hashes to a different root, so
 * it is a different row. The table is a decoding aid, never a source of truth -
 * the `RootConfigured`/`RootInvalidated` events remain authoritative for whether
 * a request exists, is ready or was cancelled.
 */
@Entity('policy_configuration_requests')
@Unique('UQ_PCR_chain_safe_root', ['chainId', 'safeAddress', 'root'])
@Index('IDX_PCR_chain_safe', ['chainId', 'safeAddress'])
export class PolicyConfigurationRequest {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'PK_PCR_id',
  })
  public readonly id!: string;

  @Column({
    name: 'chain_id',
    type: 'varchar',
    length: CHAIN_ID_MAXLENGTH,
    update: false,
  })
  public readonly chainId!: string;

  @Column({
    name: 'safe_address',
    type: 'varchar',
    length: 42,
    transformer: databaseAddressTransformer,
    update: false,
  })
  public readonly safeAddress!: Address;

  /**
   * `keccak256(abi.encode(Configuration[]))`, recomputed from `configurations`
   * before the row is written - never trusted as submitted.
   */
  @Column({ type: 'varchar', length: 66, update: false })
  public readonly root!: Hex;

  /** The configurations exactly as hashed: `data` raw, not decoded. */
  @Column({ type: 'jsonb', update: false })
  public readonly configurations!: Array<PolicyConfiguration>;

  /** Space the request came through. No FK: the row outlives space deletion. */
  @Column({ name: 'space_id', type: 'integer', update: false })
  public readonly spaceId!: number;

  /** Submitting user. No FK: the row outlives user deletion. */
  @Column({ name: 'created_by', type: 'integer', update: false })
  public readonly createdBy!: number;

  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
    insert: false,
  })
  public readonly createdAt!: Date;
}
