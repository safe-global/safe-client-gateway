import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from '@/domain/common/entities/name.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const AcceptInviteDtoSchema = z.object({
  name: z.string().max(255),
});

export class AcceptInviteDto implements z.infer<typeof AcceptInviteDtoSchema> {
  @ApiProperty({
    type: String,
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  })
  public readonly name!: string;
}
