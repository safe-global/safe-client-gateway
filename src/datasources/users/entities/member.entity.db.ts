import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { User } from '@/datasources/users/entities/users.entity.db';
import { nullableDatabaseAddressTransformer } from '@/domain/common/transformers/nullableDatabaseAddress.transformer';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';
import {
  Member as DomainMember,
  MemberRole,
  MemberStatus,
} from '@/domain/users/entities/member.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('members')
@Unique('UQ_members', ['user', 'space'])
@Index('idx_UO_name', ['name'])
@Index('idx_UO_role_status', ['role', 'status'])
export class Member implements DomainMember {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_UO_id',
  })
  id!: number;

  @ManyToOne(() => User, (user: User) => user.id, {
    cascade: true,
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_UO_user_id',
  })
  user!: User;

  @ManyToOne(() => Space, (space: Space) => space.id, {
    cascade: true,
    nullable: false,
  })
  @JoinColumn({
    name: 'space_id',
    foreignKeyConstraintName: 'FK_UO_space_id',
  })
  space!: Space;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

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
  invitedBy!: `0x${string}` | null;

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
