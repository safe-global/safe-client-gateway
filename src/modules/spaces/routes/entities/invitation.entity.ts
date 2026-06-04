// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import {
  type Member,
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

export class Invitation {
  @ApiProperty({ type: Number })
  userId!: User['id'];

  @ApiProperty({ type: String })
  name!: Member['name'];

  @ApiProperty({
    type: Number,
    deprecated: true,
    description:
      'Numeric Space id (deprecated, use spaceUuid). Kept for FE fallback',
  })
  spaceId!: Space['id'];

  @ApiProperty({ type: String, description: 'Space UUID' })
  spaceUuid!: Space['uuid'];

  @ApiProperty({ enum: getStringEnumKeys(MemberRole) })
  role!: keyof typeof MemberRole;

  @ApiProperty({ enum: getStringEnumKeys(MemberStatus) })
  status!: keyof typeof MemberStatus;

  @ApiProperty({ type: Number, nullable: true })
  invitedBy!: Member['invitedBy'];
}
