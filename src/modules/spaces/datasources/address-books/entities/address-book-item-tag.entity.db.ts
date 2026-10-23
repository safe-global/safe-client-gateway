// SPDX-License-Identifier: FSL-1.1-MIT
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { AddressBookItemTagDbItem as DomainAddressBookItemTag } from '#/modules/spaces/domain/address-books/entities/address-book-tag.db.entity';

// The foreign keys (item_id, tag_id) live in the migration.
@Entity('space_address_book_item_tags')
@Unique('UQ_SABIT_item_id_tag_id', ['itemId', 'tagId'])
@Index('IDX_SABIT_tag_id', ['tagId'])
export class AddressBookItemTag implements DomainAddressBookItemTag {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_SABIT_id',
  })
  id!: number;

  @Column({ name: 'item_id', type: 'integer' })
  itemId!: number;

  @Column({ name: 'tag_id', type: 'integer' })
  tagId!: number;

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
