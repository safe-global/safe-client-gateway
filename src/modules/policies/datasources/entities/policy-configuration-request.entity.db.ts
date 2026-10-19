// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { Address, Hex } from 'viem';
import { databaseAddressTransformer } from '#/domain/common/transformers/database-address.transformer';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import type { PolicyConfigurationRequest as DomainPolicyConfigurationRequest } from '#/modules/policies/domain/entities/policy-configuration-request.entity';
import { CHAIN_ID_MAXLENGTH } from '#/routes/common/constants';

/**
 * A stored `Configuration[]`, one row per Space, Safe and root.
 *
 * Uniqueness is split by encryption mode, as in `space_safes`. Rows are
 * immutable; a database trigger rejects every `UPDATE`.
 */
@Entity('policy_configuration_requests')
@Index(
  'UQ_PCR_space_chain_safe_root_plain',
  ['spaceId', 'chainId', 'safeAddress', 'root'],
  { unique: true, where: 'safe_address_index IS NULL' },
)
@Index(
  'UQ_PCR_space_chain_safeIndex_root',
  ['spaceId', 'chainId', 'safeAddressIndex', 'root'],
  { unique: true, where: 'safe_address_index IS NOT NULL' },
)
@Index('IDX_PCR_space_id', ['spaceId'])
export class PolicyConfigurationRequest
  implements DomainPolicyConfigurationRequest
{
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_PCR_id' })
  public readonly id!: UUID;

  /** FK to `spaces`, cascading, declared in the migration. */
  @Column({ name: 'space_id', type: 'integer', update: false })
  public readonly spaceId!: number;

  @Column({
    name: 'chain_id',
    type: 'varchar',
    length: CHAIN_ID_MAXLENGTH,
    update: false,
  })
  public readonly chainId!: string;

  /** KMS ciphertext when encryption is enabled, else the plaintext address. */
  @Column({
    name: 'safe_address',
    type: 'text',
    transformer: databaseAddressTransformer,
    update: false,
  })
  public readonly safeAddress!: Address;

  /** Blind index of the address; NULL when encryption is disabled. */
  @Column({
    name: 'safe_address_index',
    type: 'text',
    nullable: true,
    update: false,
  })
  public readonly safeAddressIndex!: string | null;

  /** `keccak256(abi.encode(configurations))`. */
  @Column({ type: 'varchar', length: 66, update: false })
  public readonly root!: Hex;

  /** The `Configuration[]` in the order the root hashes it. */
  @Column({ type: 'jsonb', update: false })
  public readonly configurations!: [
    PolicyConfiguration,
    ...Array<PolicyConfiguration>,
  ];

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
