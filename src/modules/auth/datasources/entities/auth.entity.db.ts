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
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import {
  AuthType,
  Auth as DomainAuth,
} from '@/modules/auth/domain/entities/auth.entity';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';

@Entity('auth')
@Unique('UQ_auth_type_ext_user_id', ['type', 'extUserId'])
@Index('idx_auth_user_id', ['user'])
export class Auth implements DomainAuth {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_auth_id',
  })
  id!: number;

  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(AuthType),
  })
  type!: keyof typeof AuthType;

  @Column({ name: 'ext_user_id', type: 'varchar', length: 255 })
  extUserId!: string;

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

  @ManyToOne(() => User, (user: User) => user.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_auth_user_id',
  })
  user!: User;
}
