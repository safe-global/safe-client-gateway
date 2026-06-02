// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import {
  makeNameSchema,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from '@/domain/common/schemas/name.schema';

export const AcceptInviteDtoSchema = z.object({
  name: makeNameSchema(),
});

export class AcceptInviteDto implements z.infer<typeof AcceptInviteDtoSchema> {
  @ApiProperty({
    type: String,
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  })
  public readonly name!: string;
}
