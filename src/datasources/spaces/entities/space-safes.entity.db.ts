import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { databaseAddressTransformer } from '@/domain/common/transformers/databaseAddress.transformer';
import { SpaceSafe as DomainSpaceSafe } from '@/domain/spaces/entities/space-safe.entity';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';
import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('space_safes')
@Unique('UQ_SS_chainId_address_space', ['chainId', 'address', 'space'])
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

  @Column({
    type: 'varchar',
    length: 42,
    transformer: databaseAddressTransformer,
  })
  public readonly address!: `0x${string}`;

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

  @ManyToOne(() => Space, (space: Space) => space.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'space_id',
    foreignKeyConstraintName: 'FK_SS_space_id',
  })
  public readonly space?: Space;
}
