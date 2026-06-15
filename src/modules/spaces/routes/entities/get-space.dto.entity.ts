// SPDX-License-Identifier: FSL-1.1-MIT

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import {
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';

class UserDto extends User {
  @ApiProperty({ type: Number })
  public declare id: User['id'];
}

class SpaceMemberDto {
  @ApiProperty({ type: String, enum: getStringEnumKeys(MemberRole) })
  public role!: Member['role'];

  @ApiProperty({ type: String })
  public name!: Member['name'];

  @ApiProperty({ type: Number, nullable: true })
  public invitedBy!: Member['invitedBy'];

  @ApiProperty({ type: Date, nullable: true })
  public inviteExpiresAt!: Member['inviteExpiresAt'];

  @ApiPropertyOptional({ type: String })
  public invitedByName?: string;

  @ApiProperty({
    type: String,
    enum: getStringEnumKeys(MemberStatus),
  })
  public status!: Member['status'];

  @ApiProperty({ type: UserDto })
  public user!: Partial<UserDto>;
}

export class GetSpaceResponse {
  @ApiProperty({ type: String, description: 'Space UUID' })
  public uuid!: Space['uuid'];

  @ApiProperty({ type: String })
  public name!: Space['name'];

  @ApiProperty({ type: SpaceMemberDto, isArray: true })
  public members!: Array<SpaceMemberDto>;

  @ApiProperty({
    type: Number,
    description: 'Total count of Safes in the space',
    example: 5,
  })
  public safeCount!: number;
}
