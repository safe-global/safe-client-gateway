// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { z } from 'zod';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { WalletSchema } from '@/modules/wallets/domain/entities/wallet.entity';
import type { Address } from 'viem';

@Entity('wallets')
export class Wallet implements z.infer<typeof WalletSchema> {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_wallet_id' })
  id!: number;

  @ManyToOne(() => User, (user: User) => user.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_wallets_user_id',
  })
  user!: User;

  @Column({ type: 'text' })
  address!: Address;

  @Column({
    name: 'address_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  addressHash!: string | null;

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
