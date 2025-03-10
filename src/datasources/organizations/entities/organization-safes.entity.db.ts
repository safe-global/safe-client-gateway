import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { databaseAddressTransformer } from '@/domain/common/transformers/databaseAddress.transformer';
import { OrganizationSafe as DomainOrganizationSafe } from '@/domain/organizations/entities/organization-safe.entity';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';
import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('organization_safes')
export class OrganizationSafe implements DomainOrganizationSafe {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_OS_id',
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
  public readonly address!: `0x${string}`;

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

  @ManyToOne(
    () => Organization,
    (organization: Organization) => organization.id,
    {
      onDelete: 'CASCADE',
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'FK_OS_organization_id',
  })
  public readonly organization?: Organization;
}
