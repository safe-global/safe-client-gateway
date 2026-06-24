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
import { databaseEnumTransformer } from '@/domain/common/utils/enum';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import {
  type Member as DomainMember,
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';

@Entity('members')
@Unique('UQ_members', ['user', 'space'])
// `name` is field-encrypted; a B-tree index over randomized ciphertext is useless.
@Index('idx_members_role_status', ['role', 'status'])
export class Member implements DomainMember {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_members_id',
  })
  id!: number;

  @ManyToOne(
    () => User,
    (user: User) => user.id,
    {
      cascade: true,
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_members_user_id',
  })
  user!: User;

  @ManyToOne(
    () => Space,
    (space: Space) => space.id,
    {
      cascade: true,
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'space_id',
    foreignKeyConstraintName: 'FK_members_space_id',
  })
  space!: Space;

  // Stored as `text` to hold AES-256-GCM ciphertext; plaintext length is
  // validated by the Zod schema (MEMBER_NAME_MAX_LENGTH) before encryption.
  // Encrypted in MembersRepository under the owning space's data key.
  @Column({ type: 'text' })
  name!: string;

  // Stored as `text` to hold ciphertext; plaintext length is validated by the
  // Zod schema (NAME_MAX_LENGTH) before encryption. Encrypted in MembersRepository
  // under the owning space's data key.
  @Column({
    type: 'text',
    nullable: true,
  })
  alias!: string | null;

  // Postgres enums are string therefore we use integer
  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(MemberRole),
  })
  role!: keyof typeof MemberRole;

  // Postgres enums are string therefore we use integer
  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(MemberStatus),
  })
  status!: keyof typeof MemberStatus;

  @Column({
    name: 'invited_by',
    type: 'integer',
    nullable: true,
  })
  invitedBy!: number | null;

  @Column({
    name: 'invite_expires_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  inviteExpiresAt!: Date | null;

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
