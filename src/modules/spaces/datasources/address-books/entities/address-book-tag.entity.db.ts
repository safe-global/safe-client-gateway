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
import { Space } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { TagColor } from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import type { AddressBookTagDbItem as DomainAddressBookTag } from '#/modules/spaces/domain/address-books/entities/address-book-tag-db.entity';

@Entity('space_address_book_tags')
@Index('IDX_SABT_space_id', ['space'])
@Unique('UQ_SABT_space_id_name_index', ['space', 'nameIndex'])
@Unique('UQ_SABT_space_id_color', ['space', 'color'])
export class AddressBookTag implements DomainAddressBookTag {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_SABT_id',
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
    foreignKeyConstraintName: 'FK_SABT_space_id',
  })
  public readonly space!: Space;

  // Encrypted directly by KMS.
  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'name_index', type: 'text' })
  nameIndex!: string;

  @Column({ type: 'varchar', length: 16 })
  color!: TagColor;

  @Column({
    name: 'created_by',
    type: 'integer',
    nullable: false,
  })
  createdBy!: number;

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
