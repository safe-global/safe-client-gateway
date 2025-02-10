import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { User } from '@/datasources/users/entities/users.entity.db';
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

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  // Postgres enums are string therefore we use integer
  @Column({
    type: 'integer',
  })
  role!: UserOrganizationRole;

  // Postgres enums are string therefore we use integer
  @Column({
    type: 'integer',
  })
  status!: UserOrganizationStatus;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  created_at!: Date;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  updated_at!: Date;
}
