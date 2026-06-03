// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { makeNameSchema } from '@/domain/common/schemas/name.schema';

export const AcceptInviteDtoSchema = z.object({
  name: makeNameSchema({ maxLength: 255 }),
});

export class AcceptInviteDto implements z.infer<typeof AcceptInviteDtoSchema> {
  @ApiProperty({ type: String, maxLength: 255 })
  public readonly name!: string;
}
