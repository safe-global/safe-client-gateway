// SPDX-License-Identifier: FSL-1.1-MIT
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceSafe as DomainSpaceSafe } from '@/modules/spaces/domain/entities/space-safe.entity';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';
import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Address } from 'viem';

@Entity('space_safes')
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

  @Column({ type: 'text' })
  public readonly address!: Address;

  @Column({
    name: 'address_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  public readonly addressHash!: string | null;

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
