import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { NameSchema } from '@/domain/common/entities/name.schema';

export const UpdateMemberNameDtoSchema = z.object({
  name: NameSchema,
});

export class UpdateMemberNameDto
  implements z.infer<typeof UpdateMemberNameDtoSchema>
{
  @ApiProperty({
    type: String,
    description: 'The new name for the member',
  })
  public readonly name!: string;
}
