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
  OauthType,
  Oauth as DomainOauth,
} from '@/modules/auth/domain/entities/oauth.entity';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';

@Entity('oauth')
@Unique('UQ_oauth_type_ext_user_id', ['type', 'extUserId'])
@Index('idx_oauth_user_id', ['user'])
export class Oauth implements DomainOauth {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_oauth_id',
  })
  id!: number;

  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(OauthType),
  })
  type!: keyof typeof OauthType;

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
  })
  updatedAt!: Date;

  @ManyToOne(() => User, (user: User) => user.oauths, {
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_oauth_user_id',
  })
  user!: User;
}
