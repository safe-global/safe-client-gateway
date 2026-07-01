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
import type { Address } from 'viem';
import { databaseAddressTransformer } from '@/domain/common/transformers/databaseAddress.transformer';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { AddressBookDbItem as DomainAddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';

@Entity('space_address_book_items')
@Unique('UQ_SABI_space_id_address', ['space', 'address'])
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

  @Column({
    name: 'address',
    type: 'varchar',
    length: 42,
    nullable: false,
    transformer: databaseAddressTransformer,
  })
  address!: Address;

  // Stored as `text` to hold AES-256-GCM ciphertext; plaintext length is
  // validated by the Zod schema (ADDRESS_BOOK_NAME_MAX_LENGTH) before encryption.
  // Encrypted in AddressBookItemsRepository under the owning space's data key.
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
