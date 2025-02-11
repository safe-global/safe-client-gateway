import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  OrganizationStatus,
  Organization as DomainOrganization,
} from '@/domain/organizations/entities/organization.entity';
import { UserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';

// @todo make organizations singular, The database table name should remain plural
@Entity('organizations')
export class Organization implements DomainOrganization {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_org_id' })
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Index('idx_org_status')
  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(OrganizationStatus),
  })
  status!: keyof typeof OrganizationStatus;

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

  @OneToMany(
    () => UserOrganization,
    (userOrganization: UserOrganization) => userOrganization.organization,
    { cascade: ['update', 'insert'] },
  )
  @JoinColumn({ name: 'user_organizations' })
  userOrganizations!: Array<UserOrganization>;
}
