import { getStringEnumKeys } from '@/domain/common/utils/enum';
import {
  UserOrganizationRole,
  UserOrganizationStatus,
  type UserOrganization as DomainUserOrganization,
} from '@/domain/users/entities/user-organization.entity';
import { UserStatus, type User } from '@/domain/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

class UserOrganizationUser implements Pick<User, 'id'> {
  @ApiProperty({ type: Number })
  id!: User['id'];

  @ApiProperty({ enum: getStringEnumKeys(UserStatus) })
  status!: keyof typeof UserStatus;

  @ApiProperty({ type: String, isArray: true })
  wallets!: Array<`0x${string}`>;
}

class UserOrganization {
  @ApiProperty({ type: Number })
  id!: DomainUserOrganization['id'];

  @ApiProperty({ enum: getStringEnumKeys(UserOrganizationRole) })
  role!: keyof typeof UserOrganizationRole;

  @ApiProperty({ enum: getStringEnumKeys(UserOrganizationStatus) })
  status!: keyof typeof UserOrganizationStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: UserOrganizationUser })
  user!: UserOrganizationUser;
}

export class UserOrganizationsDto {
  @ApiProperty({ type: UserOrganization, isArray: true })
  members!: Array<UserOrganization>;
}
