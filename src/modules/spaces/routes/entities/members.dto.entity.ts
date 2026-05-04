// SPDX-License-Identifier: FSL-1.1-MIT
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import {
  MemberRole,
  MemberStatus,
  type Member as DomainMember,
} from '@/modules/users/domain/entities/member.entity';
import {
  UserStatus,
  type User,
} from '@/modules/users/domain/entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MemberUser implements Pick<User, 'id'> {
  @ApiProperty({ type: Number })
  id!: User['id'];

  @ApiProperty({ enum: getStringEnumKeys(UserStatus) })
  status!: keyof typeof UserStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  email!: User['email'];
}

export class MemberDto {
  @ApiProperty({ type: Number })
  id!: DomainMember['id'];

  @ApiProperty({ enum: getStringEnumKeys(MemberRole) })
  role!: keyof typeof MemberRole;

  @ApiProperty({ enum: getStringEnumKeys(MemberStatus) })
  status!: keyof typeof MemberStatus;

  @ApiProperty({ type: String })
  name!: DomainMember['name'];

  @ApiPropertyOptional({ type: String, nullable: true })
  alias!: DomainMember['alias'];

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
  @ApiProperty({ type: MemberDto, isArray: true })
  members!: Array<MemberDto>;
}
