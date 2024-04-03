import { DeleteSafeDelegateDtoSchema } from '@/routes/delegates/entities/schemas/delete-safe-delegate.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class DeleteSafeDelegateDto
  implements z.infer<typeof DeleteSafeDelegateDtoSchema>
{
  @ApiProperty()
  delegate!: `0x${string}`;
  @ApiProperty()
  safe!: `0x${string}`;
  @ApiProperty()
  signature!: `0x${string}`;
}
