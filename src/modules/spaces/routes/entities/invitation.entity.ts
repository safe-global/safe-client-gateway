import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Member,
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

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
