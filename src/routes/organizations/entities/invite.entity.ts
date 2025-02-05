import { ApiProperty } from '@nestjs/swagger';
import {
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';

export class Invite {
  @ApiProperty()
  userId!: User['id'];

  @ApiProperty()
  orgId!: Organization['id'];

  @ApiProperty({ enum: Object.keys(UserOrganizationRole) })
  role!: UserOrganization['role'];

  @ApiProperty({ enum: Object.keys(UserOrganizationStatus) })
  status!: UserOrganization['status'];
}
