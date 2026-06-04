// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { makeNameSchema } from '@/domain/common/schemas/name.schema';
import { MEMBER_NAME_MAX_LENGTH } from '@/modules/users/domain/entities/member.entity';

export const AcceptInviteDtoSchema = z.object({
  name: makeNameSchema({ maxLength: MEMBER_NAME_MAX_LENGTH }),
});

export class AcceptInviteDto implements z.infer<typeof AcceptInviteDtoSchema> {
  @ApiProperty({ type: String, maxLength: MEMBER_NAME_MAX_LENGTH })
  public readonly name!: string;
}
