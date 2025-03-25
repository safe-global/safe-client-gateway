import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Member,
  MemberRole,
  MemberStatus,
} from '@/domain/users/entities/member.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space } from '@/domain/spaces/entities/space.entity';
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
