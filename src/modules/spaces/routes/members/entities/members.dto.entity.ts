// SPDX-License-Identifier: FSL-1.1-MIT

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import {
  type Member as DomainMember,
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';
import {
  type User,
  UserStatus,
} from '@/modules/users/domain/entities/user.entity';

class MemberUser implements Pick<User, 'id' | 'email'> {
  @ApiProperty({ type: Number })
  id!: User['id'];

  @ApiProperty({ enum: getStringEnumKeys(UserStatus) })
  status!: keyof typeof UserStatus;

  @ApiProperty({ type: String, nullable: true })
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

  @ApiProperty({ type: Number, nullable: true })
  invitedBy!: DomainMember['invitedBy'];

  @ApiPropertyOptional({ type: Date, nullable: true })
  inviteExpiresAt!: DomainMember['inviteExpiresAt'];

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
