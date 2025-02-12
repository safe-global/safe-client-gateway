import { ApiProperty } from '@nestjs/swagger';
import {
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';

export class Invitation {
  @ApiProperty({ type: Number })
  userId!: User['id'];

  @ApiProperty({ type: Number })
  orgId!: Organization['id'];

  @ApiProperty({ enum: Object.keys(UserOrganizationRole) })
  role!: keyof typeof UserOrganizationRole;

  @ApiProperty({ enum: Object.keys(UserOrganizationStatus) })
  status!: keyof typeof UserOrganizationStatus;
}
