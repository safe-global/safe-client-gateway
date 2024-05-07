import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class EditEmailDto implements z.infer<typeof EditEmailDtoSchema> {
  @ApiProperty()
  emailAddress!: string;
}

export const EditEmailDtoSchema = z.object({
  emailAddress: z.string().email(),
});
