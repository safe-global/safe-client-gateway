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
import type { z } from 'zod';
import { databaseAddressTransformer } from '@/domain/common/transformers/database-address.transformer';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import type { WalletSchema } from '@/modules/wallets/domain/entities/wallet.entity';

@Entity('wallets')
// Plaintext uniqueness for rows the backfill has not reached; blind-index
// uniqueness for encrypted rows (a TypeORM @Unique cannot express partials).
@Index('UQ_wallet_address_plain', ['address'], {
  unique: true,
  where: '"address_index" IS NULL',
})
@Index('UQ_wallet_address_index', ['addressIndex'], {
  unique: true,
  where: '"address_index" IS NOT NULL',
})
export class Wallet implements z.infer<typeof WalletSchema> {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_wallet_id' })
  id!: number;

  @ManyToOne(
    () => User,
    (user: User) => user.id,
    {
      onDelete: 'CASCADE',
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_wallets_user_id',
  })
  user!: User;

  // Encrypted directly by KMS bound to the owning user (`kms:v1:...`) once
  // field encryption is enabled; EIP-55 plaintext until the backfill reaches
  // the row. Lookups and uniqueness for encrypted rows use `addressIndex`.
  // The transformer passes `kms:` values through untouched and checksums
  // everything else. Encryption is performed in WalletsRepository /
  // UsersRepository (both know the owning userId before every insert).
  @Column({
    type: 'text',
    transformer: databaseAddressTransformer,
  })
  address!: Address;

  // Blind index (keyed HMAC) of the plaintext address; NULL until the row
  // is encrypted. Stored verbatim, deliberately no transformer.
  @Column({
    name: 'address_index',
    type: 'text',
    nullable: true,
  })
  addressIndex?: string | null;

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
