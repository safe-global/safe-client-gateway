// SPDX-License-Identifier: FSL-1.1-MIT
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import {
  databaseAddressTransformer,
  databaseNullableAddressTransformer,
} from '@/domain/common/transformers/databaseAddress.transformer';
import { CounterfactualSafe as DomainCounterfactualSafe } from '@/modules/counterfactual-safes/domain/entities/counterfactual-safe.entity';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';
import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Address, Hex } from 'viem';

@Entity('counterfactual_safes')
@Unique('UQ_CFS_chainId_address', ['chainId', 'address'])
export class CounterfactualSafe implements DomainCounterfactualSafe {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_CFS_id',
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
  public readonly address!: Address;

  @Column({
    name: 'factory_address',
    type: 'varchar',
    length: 42,
    transformer: databaseAddressTransformer,
  })
  public readonly factoryAddress!: Address;

  @Column({
    name: 'master_copy',
    type: 'varchar',
    length: 42,
    transformer: databaseAddressTransformer,
  })
  public readonly masterCopy!: Address;

  @Column({
    name: 'salt_nonce',
    type: 'varchar',
    length: 78,
  })
  public readonly saltNonce!: string;

  @Column({
    name: 'safe_version',
    type: 'varchar',
    length: 20,
  })
  public readonly safeVersion!: string;

  @Column({
    type: 'integer',
  })
  public readonly threshold!: number;

  @Column({
    type: 'jsonb',
  })
  public readonly owners!: Array<Address>;

  @Column({
    name: 'fallback_handler',
    type: 'varchar',
    length: 42,
    nullable: true,
    transformer: databaseNullableAddressTransformer,
  })
  public readonly fallbackHandler!: Address | null;

  @Column({
    name: 'setup_to',
    type: 'varchar',
    length: 42,
    nullable: true,
    transformer: databaseNullableAddressTransformer,
  })
  public readonly setupTo!: Address | null;

  @Column({
    name: 'setup_data',
    type: 'text',
  })
  public readonly setupData!: Hex;

  @Column({
    name: 'payment_token',
    type: 'varchar',
    length: 42,
    nullable: true,
    transformer: databaseNullableAddressTransformer,
  })
  public readonly paymentToken!: Address | null;

  @Column({
    type: 'numeric',
    nullable: true,
  })
  public readonly payment!: string | null;

  @Column({
    name: 'payment_receiver',
    type: 'varchar',
    length: 42,
    nullable: true,
    transformer: databaseNullableAddressTransformer,
  })
  public readonly paymentReceiver!: Address | null;

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

  @ManyToOne(() => User, (user: User) => user.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({
    name: 'creator_id',
    foreignKeyConstraintName: 'FK_CFS_creator_id',
  })
  public readonly creator?: User | null;
}
