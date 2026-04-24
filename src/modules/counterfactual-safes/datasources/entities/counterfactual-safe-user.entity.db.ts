// SPDX-License-Identifier: FSL-1.1-MIT
import { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('counterfactual_safe_users')
@Unique('UQ_CFSU_cf_safe_user', ['counterfactualSafe', 'user'])
export class CounterfactualSafeUser {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_CFSU_id',
  })
  public readonly id!: number;

  @ManyToOne(
    () => CounterfactualSafe,
    (counterfactualSafe: CounterfactualSafe) => counterfactualSafe.id,
    { onDelete: 'CASCADE', nullable: false },
  )
  @JoinColumn({
    name: 'counterfactual_safe_id',
    foreignKeyConstraintName: 'FK_CFSU_cf_safe_id',
  })
  public readonly counterfactualSafe!: CounterfactualSafe;

  @ManyToOne(() => User, (user: User) => user.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_CFSU_user_id',
  })
  public readonly user!: User;

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
}
