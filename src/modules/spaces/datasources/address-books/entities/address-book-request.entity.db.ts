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
import { databaseEnumTransformer } from '@/domain/common/utils/enum';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import {
  AddressBookRequestStatus,
  AddressBookRequest as DomainAddressBookRequest,
} from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
import { User } from '@/modules/users/datasources/entities/users.entity.db';

@Entity('address_book_requests')
// Split partial-unique indexes across the backfill window: plaintext pending
// rows (address_index IS NULL) keep the old semantics, encrypted pending rows
// are unique per blind index. Matches the 1781700000000-space-field-encryption
// migration.
@Index(
  'UQ_ABR_space_requester_address_pending_plain',
  ['space', 'requestedBy', 'address'],
  { unique: true, where: 'status = 0 AND address_index IS NULL' },
)
@Index(
  'UQ_ABR_space_requester_address_index_pending',
  ['space', 'requestedBy', 'addressIndex'],
  { unique: true, where: 'status = 0 AND address_index IS NOT NULL' },
)
@Index('IDX_ABR_space_status', ['space', 'status'])
export class AddressBookRequest implements DomainAddressBookRequest {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_ABR_id',
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
    foreignKeyConstraintName: 'FK_ABR_space_id',
  })
  public readonly space!: Space;

  @ManyToOne(
    () => User,
    (user: User) => user.id,
    {
      onDelete: 'CASCADE',
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'requested_by',
    foreignKeyConstraintName: 'FK_ABR_requested_by',
  })
  public readonly requestedBy!: User;

  @Column({
    name: 'chain_ids',
    type: 'varchar',
    length: 32,
    nullable: false,
    array: true,
  })
  public readonly chainIds!: Array<string>;

  // Encrypted directly by KMS under the space-scoped context; ciphertext passes
  // through the transformer untouched, plaintext is checksummed as before.
  // Encryption is performed in AddressBookRequestsRepository.
  @Column({
    name: 'address',
    type: 'text',
    nullable: false,
    transformer: databaseAddressTransformer,
  })
  address!: Address;

  // Blind index of the plaintext address; NULL until written encrypted or
  // backfilled. No transformer: tokens are stored verbatim.
  @Column({ name: 'address_index', type: 'text', nullable: true })
  public readonly addressIndex?: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(AddressBookRequestStatus),
  })
  status!: keyof typeof AddressBookRequestStatus;

  @Column({
    name: 'reviewed_by',
    type: 'integer',
    nullable: true,
  })
  reviewedBy!: number | null;

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
