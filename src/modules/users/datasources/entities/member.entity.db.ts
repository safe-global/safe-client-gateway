import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { nullableDatabaseAddressTransformer } from '@/domain/common/transformers/nullableDatabaseAddress.transformer';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';
import {
  Member as DomainMember,
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { NAME_MAX_LENGTH } from '@/domain/common/schemas/name.schema';
import type { Address } from 'viem';

@Entity('members')
@Unique('UQ_members', ['user', 'space'])
@Index('idx_members_role_status', ['role', 'status'])
export class Member implements DomainMember {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_members_id',
  })
  id!: number;

  @ManyToOne(() => User, (user: User) => user.id, {
    cascade: true,
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_members_user_id',
  })
  user!: User;

  @ManyToOne(() => Space, (space: Space) => space.id, {
    cascade: true,
    nullable: false,
  })
  @JoinColumn({
    name: 'space_id',
    foreignKeyConstraintName: 'FK_members_space_id',
  })
  space!: Space;

  /** Plaintext in memory; AES-256-GCM ciphertext in DB when encrypted */
  @Column({ type: 'text' })
  name!: string;

  /** HMAC-SHA256 blind index for equality lookups without decrypting */
  @Column({ name: 'name_hash', type: 'varchar', length: 64, nullable: true })
  nameHash!: string | null;

  /** DEK version used to encrypt; null = legacy plaintext row */
  @Column({
    name: 'encryption_version',
    type: 'integer',
    nullable: true,
  })
  encryptionVersion!: number | null;

  @Column({ type: 'varchar', length: NAME_MAX_LENGTH, nullable: true })
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
    type: 'varchar',
    length: 42,
    nullable: true,
    transformer: nullableDatabaseAddressTransformer,
  })
  invitedBy!: Address | null;

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
