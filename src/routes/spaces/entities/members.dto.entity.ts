import { getStringEnumKeys } from '@/domain/common/utils/enum';
import {
  MemberRole,
  MemberStatus,
  type Member as DomainMember,
} from '@/domain/users/entities/member.entity';
import { UserStatus, type User } from '@/domain/users/entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MemberUser implements Pick<User, 'id'> {
  @ApiProperty({ type: Number })
  id!: User['id'];

  @ApiProperty({ enum: getStringEnumKeys(UserStatus) })
  status!: keyof typeof UserStatus;
}

class Member {
  @ApiProperty({ type: Number })
  id!: DomainMember['id'];

  @ApiProperty({ enum: getStringEnumKeys(MemberRole) })
  role!: keyof typeof MemberRole;

  @ApiProperty({ enum: getStringEnumKeys(MemberStatus) })
  status!: keyof typeof MemberStatus;

  @ApiProperty({ type: String })
  name!: DomainMember['name'];

  @ApiPropertyOptional({ type: String, nullable: true })
  invitedBy!: DomainMember['invitedBy'];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: MemberUser })
  user!: MemberUser;
}

export class MembersDto {
  @ApiProperty({ type: Member, isArray: true })
  members!: Array<Member>;
}
