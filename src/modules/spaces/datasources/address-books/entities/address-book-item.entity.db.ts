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
import type { AddressBookDbItem as DomainAddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';

@Entity('space_address_book_items')
// Split partial-unique indexes by encryption mode (TypeORM @Unique cannot
// express partials): plaintext rows (address_index IS NULL, encryption
// disabled) keep the old semantics, encrypted rows are unique per blind
// index. Matches the 1781700000000-space-field-encryption migration.
@Index('UQ_SABI_space_id_address_plain', ['space', 'address'], {
  unique: true,
  where: 'address_index IS NULL',
})
@Index('UQ_SABI_space_id_address_index', ['space', 'addressIndex'], {
  unique: true,
  where: 'address_index IS NOT NULL',
})
@Index('IDX_SABI_space_id', ['space'])
export class AddressBookItem implements DomainAddressBookItem {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_SABI_id',
  })
  id!: number;

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
    foreignKeyConstraintName: 'FK_SABI_space_id',
  })
  public readonly space!: Space;

  @Column({
    name: 'chain_ids',
    type: 'varchar',
    length: 32,
    nullable: false,
    array: true,
  })
  public readonly chainIds!: Array<string>;

  // Encrypted directly by KMS under the space-scoped context; ciphertext
  // (`kms:v1:`) passes through the transformer untouched, plaintext is
  // checksummed as before. text: ciphertext exceeds 42 chars. Encryption is
  // performed in AddressBookItemsRepository.
  @Column({
    name: 'address',
    type: 'text',
    nullable: false,
    transformer: databaseAddressTransformer,
  })
  address!: Address;

  // Blind index of the plaintext address for lookups/uniqueness while
  // `address` is non-deterministic ciphertext. NULL for plaintext rows
  // (encryption disabled). No transformer: tokens are stored verbatim.
  @Column({ name: 'address_index', type: 'text', nullable: true })
  public readonly addressIndex?: string | null;

  // Encrypted directly by KMS (text: ciphertext exceeds the plaintext cap;
  // plaintext length limits stay in the Zod DTOs).
  @Column({ type: 'text' })
  name!: string;

  @Column({
    name: 'created_by',
    type: 'integer',
    nullable: false,
  })
  createdBy!: number;

  @Column({
    name: 'last_updated_by',
    type: 'integer',
    nullable: false,
  })
  lastUpdatedBy!: number;

  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  updatedAt!: Date;
}
