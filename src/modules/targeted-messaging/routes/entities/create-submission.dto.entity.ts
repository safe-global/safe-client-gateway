import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateSubmissionDtoSchema = z.object({
  completed: z.boolean().refine((val) => val === true, {
    message: 'The value must be true',
  }),
});

export class CreateSubmissionDto
  implements z.infer<typeof CreateSubmissionDtoSchema>
{
  @ApiProperty()
  completed!: boolean;
}
