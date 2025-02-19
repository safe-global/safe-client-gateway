import {
  Column,
  Entity,
  Unique,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { z } from 'zod';
import { User } from '@/datasources/users/entities/users.entity.db';
import { WalletSchema } from '@/domain/wallets/entities/wallet.entity';
import { databaseAddressTransformer } from '@/domain/common/transformers/databaseAddress.transformer';

@Entity('wallets')
@Unique('UQ_wallet_address', ['address'])
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

  @Column({
    type: 'varchar',
    length: 42,
    transformer: databaseAddressTransformer,
  })
  address!: `0x${string}`;

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
