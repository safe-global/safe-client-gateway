import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const AcceptInviteDtoSchema = z.object({
  name: z.string().max(255),
});

export class AcceptInviteDto implements z.infer<typeof AcceptInviteDtoSchema> {
  @ApiProperty({ type: String })
  public readonly name!: string;
}
