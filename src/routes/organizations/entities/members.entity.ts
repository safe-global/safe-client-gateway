import {
  UserOrganizationRole,
  UserOrganizationStatus,
  type UserOrganization,
} from '@/domain/users/entities/user-organization.entity';
import { UserStatus, type User } from '@/domain/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

class MemberUser implements Pick<User, 'id'> {
  @ApiProperty()
  id!: User['id'];

  @ApiProperty({ enum: Object.keys(UserStatus) })
  status!: keyof typeof UserStatus;
}

class Member {
  @ApiProperty()
  id!: UserOrganization['id'];

  @ApiProperty({ enum: Object.keys(UserOrganizationRole) })
  role!: keyof typeof UserOrganizationRole;

  @ApiProperty({ enum: Object.keys(UserOrganizationStatus) })
  status!: keyof typeof UserOrganizationStatus;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: MemberUser })
  user!: MemberUser;
}

export class Members {
  @ApiProperty({ type: Member, isArray: true })
  members!: Array<Member>;
}
