import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  OrganizationStatus,
  Organization as DomainOrganization,
} from '@/domain/organizations/entities/organization.entity';

@Entity('organizations')
export class Organizations implements DomainOrganization {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_org_id' })
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Index('idx_org_status')
  @Column({
    type: 'integer',
  })
  status!: OrganizationStatus;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at!: Date;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at!: Date;
}
