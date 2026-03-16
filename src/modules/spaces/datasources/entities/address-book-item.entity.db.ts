import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { databaseAddressTransformer } from '@/domain/common/transformers/databaseAddress.transformer';
import { AddressBookDbItem as DomainAddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
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

@Entity('space_address_book_items')
@Unique('UQ_SABI_space_id_address', ['space', 'address'])
@Index('IDX_SABI_space_id', ['space'])
export class AddressBookItem implements DomainAddressBookItem {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_SABI_id',
  })
  id!: number;

  @ManyToOne(() => Space, (space: Space) => space.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
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

  /** Plaintext in memory; AES-256-GCM ciphertext in DB when encrypted */
  @Column({ type: 'text' })
  name!: string;

  /** HMAC-SHA256 blind index for equality lookups without decrypting */
  @Column({ name: 'name_hash', type: 'varchar', length: 64, nullable: true })
  nameHash!: string | null;

  /** DEK version used to encrypt; null = legacy plaintext row */
  @Column({
    name: 'encryption_version',
    type: 'integer',
    nullable: true,
  })
  encryptionVersion!: number | null;

  @Column({
    name: 'created_by',
    type: 'varchar',
    length: 42,
    nullable: false,
    transformer: databaseAddressTransformer,
  })
  createdBy!: Address;

  @Column({
    name: 'last_updated_by',
    type: 'varchar',
    length: 42,
    nullable: false,
    transformer: databaseAddressTransformer,
  })
  lastUpdatedBy!: Address;

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
