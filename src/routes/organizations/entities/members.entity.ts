import {
  UserOrganizationRole,
  UserOrganizationStatus,
  type UserOrganization,
} from '@/domain/users/entities/user-organization.entity';
import { UserStatus, type User } from '@/domain/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

class MemberUser implements Pick<User, 'id' | 'status'> {
  @ApiProperty()
  id!: User['id'];

  @ApiProperty({ enum: Object.keys(UserStatus) })
  status!: User['status'];
}

class Member {
  @ApiProperty()
  id!: UserOrganization['id'];

  @ApiProperty({ enum: Object.keys(UserOrganizationRole) })
  role!: UserOrganization['role'];

  @ApiProperty({ enum: Object.keys(UserOrganizationStatus) })
  status!: UserOrganization['status'];

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
