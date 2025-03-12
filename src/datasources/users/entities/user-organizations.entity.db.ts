import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { User } from '@/datasources/users/entities/users.entity.db';
import { nullableDatabaseAddressTransformer } from '@/domain/common/transformers/nullableDatabaseAddress.transformer';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';
import {
  UserOrganization as DomainUserOrganization,
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('user_organizations')
@Unique('UQ_user_organizations', ['user', 'organization'])
@Index('idx_UO_name', ['name'])
@Index('idx_UO_role_status', ['role', 'status'])
export class UserOrganization implements DomainUserOrganization {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_UO_id',
  })
  id!: number;

  @ManyToOne(() => User, (user: User) => user.id, {
    cascade: true,
    nullable: false,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_UO_user_id',
  })
  user!: User;

  @ManyToOne(
    () => Organization,
    (organization: Organization) => organization.id,
    {
      cascade: true,
      nullable: false,
    },
  )
  @JoinColumn({
    foreignKeyConstraintName: 'FK_UO_organization_id',
  })
  organization!: Organization;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // Postgres enums are string therefore we use integer
  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(UserOrganizationRole),
  })
  role!: keyof typeof UserOrganizationRole;

  // Postgres enums are string therefore we use integer
  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(UserOrganizationStatus),
  })
  status!: keyof typeof UserOrganizationStatus;

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
