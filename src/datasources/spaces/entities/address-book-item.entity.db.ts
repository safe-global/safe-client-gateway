import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { NAME_MAX_LENGTH } from '@/domain/common/entities/name.schema';
import { databaseAddressTransformer } from '@/domain/common/transformers/databaseAddress.transformer';
import { AddressBookDbItem as DomainAddressBookItem } from '@/domain/spaces/address-books/entities/address-book-item.db.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

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
  address!: `0x${string}`;

  @Column({
    type: 'varchar',
    length: NAME_MAX_LENGTH,
  })
  name!: string;

  @Column({
    name: 'created_by',
    type: 'varchar',
    length: 42,
    nullable: false,
    transformer: databaseAddressTransformer,
  })
  createdBy!: `0x${string}`;

  @Column({
    name: 'last_updated_by',
    type: 'varchar',
    length: 42,
    nullable: false,
    transformer: databaseAddressTransformer,
  })
  lastUpdatedBy!: `0x${string}`;

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
