// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Address } from 'viem';
import { databaseAddressTransformer } from '@/domain/common/transformers/database-address.transformer';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { SpaceSafe as DomainSpaceSafe } from '@/modules/spaces/domain/safes/entities/space-safe.entity';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';

@Entity('space_safes')
// Uniqueness is split across the backfill window (TypeORM @Unique cannot
// express partial indexes): plaintext rows (address_index IS NULL) keep the
// old semantics, encrypted rows are unique per blind index. Matches the
// 1781700000000-space-field-encryption migration.
@Index('UQ_SS_chainId_address_space_plain', ['chainId', 'address', 'space'], {
  unique: true,
  where: 'address_index IS NULL',
})
@Index(
  'UQ_SS_chainId_addressIndex_space',
  ['chainId', 'addressIndex', 'space'],
  {
    unique: true,
    where: 'address_index IS NOT NULL',
  },
)
export class SpaceSafe implements DomainSpaceSafe {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_SS_id',
  })
  public readonly id!: number;

  @Column({
    name: 'chain_id',
    type: 'varchar',
    length: CHAIN_ID_MAXLENGTH,
  })
  public readonly chainId!: string;

  // Encrypted directly by KMS under the space-scoped context; ciphertext
  // (`kms:v1:`) passes through the encryption-aware transformer untouched,
  // plaintext is checksummed exactly as before. text: ciphertext exceeds 42
  // chars. Encryption is performed in SpaceSafesRepository.
  @Column({
    type: 'text',
    transformer: databaseAddressTransformer,
  })
  public readonly address!: Address;

  // Blind index (deterministic keyed HMAC) of the plaintext address, for
  // lookups and uniqueness while `address` is non-deterministic ciphertext.
  // NULL until the row is written encrypted or backfilled. No transformer:
  // tokens are stored verbatim.
  @Column({ name: 'address_index', type: 'text', nullable: true })
  public readonly addressIndex?: string | null;

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
    foreignKeyConstraintName: 'FK_SS_space_id',
  })
  public readonly space?: Space;
}
