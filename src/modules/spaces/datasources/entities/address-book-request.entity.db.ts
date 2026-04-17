// SPDX-License-Identifier: FSL-1.1-MIT
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { ADDRESS_BOOK_NAME_MAX_LENGTH } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import { databaseAddressTransformer } from '@/domain/common/transformers/databaseAddress.transformer';
import { nullableDatabaseAddressTransformer } from '@/domain/common/transformers/nullableDatabaseAddress.transformer';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';
import {
  AddressBookRequest as DomainAddressBookRequest,
  AddressBookRequestStatus,
} from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
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

@Entity('address_book_requests')
@Unique('UQ_ABR_space_requester_address', ['space', 'requestedBy', 'address'])
@Index('IDX_ABR_space_status', ['space', 'status'])
export class AddressBookRequest implements DomainAddressBookRequest {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_ABR_id',
  })
  id!: number;

  @ManyToOne(() => Space, (space: Space) => space.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'space_id',
    foreignKeyConstraintName: 'FK_ABR_space_id',
  })
  public readonly space!: Space;

  @ManyToOne(() => User, (user: User) => user.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
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

  @Column({
    name: 'address',
    type: 'varchar',
    length: 42,
    nullable: false,
    transformer: databaseAddressTransformer,
  })
  address!: Address;

  @Column({
    type: 'varchar',
    length: ADDRESS_BOOK_NAME_MAX_LENGTH,
  })
  name!: string;

  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(AddressBookRequestStatus),
  })
  status!: keyof typeof AddressBookRequestStatus;

  @Column({
    name: 'reviewed_by',
    type: 'varchar',
    length: 42,
    nullable: true,
    transformer: nullableDatabaseAddressTransformer,
  })
  reviewedBy!: Address | null;

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
