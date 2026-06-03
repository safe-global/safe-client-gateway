// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const AcceptInviteDtoSchema = z.object({
  name: z.string().max(255),
});

export class AcceptInviteDto implements z.infer<typeof AcceptInviteDtoSchema> {
  @ApiProperty({ type: String, maxLength: 255 })
  public readonly name!: string;
}
