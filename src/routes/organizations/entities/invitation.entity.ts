import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  UserOrganization,
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';

export class Invitation {
  @ApiProperty({ type: Number })
  userId!: User['id'];

  @ApiProperty({ type: Number })
  orgId!: Organization['id'];

  @ApiProperty({ enum: getStringEnumKeys(UserOrganizationRole) })
  role!: keyof typeof UserOrganizationRole;

  @ApiProperty({ enum: getStringEnumKeys(UserOrganizationStatus) })
  status!: keyof typeof UserOrganizationStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  invitedBy!: UserOrganization['invitedBy'];
}
