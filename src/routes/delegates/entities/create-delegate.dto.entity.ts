import { CreateDelegateDtoSchema } from '@/routes/delegates/entities/schemas/create-delegate.dto.schema';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class CreateDelegateDto
  implements z.infer<typeof CreateDelegateDtoSchema>
{
  @ApiPropertyOptional()
  safe?: `0x${string}`;
  @ApiProperty()
  delegate!: `0x${string}`;
  @ApiProperty()
  delegator!: `0x${string}`;
  @ApiProperty()
  signature!: string;
  @ApiProperty()
  label!: string;
}
