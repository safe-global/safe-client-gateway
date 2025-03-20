import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  UserOrganization as Member,
  UserOrganizationRole as MemberRole,
  UserOrganizationStatus as MemberStatus,
} from '@/domain/users/entities/user-organization.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Organization as Space } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';

export class Invitation {
  @ApiProperty({ type: Number })
  userId!: User['id'];

  @ApiProperty({ type: String })
  name!: Member['name'];

  @ApiProperty({ type: Number })
  spaceId!: Space['id'];

  @ApiProperty({ enum: getStringEnumKeys(MemberRole) })
  role!: keyof typeof MemberRole;

  @ApiProperty({ enum: getStringEnumKeys(MemberStatus) })
  status!: keyof typeof MemberStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  invitedBy!: Member['invitedBy'];
}
