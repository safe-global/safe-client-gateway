import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { NameSchema } from '@/domain/common/entities/name.schema';

export const UpdateMemberAliasDtoSchema = z.object({
  alias: NameSchema,
});

export class UpdateMemberAliasDto
  implements z.infer<typeof UpdateMemberAliasDtoSchema>
{
  @ApiProperty({
    type: String,
    description: 'The new alias for the member',
  })
  public readonly alias!: string;
}
