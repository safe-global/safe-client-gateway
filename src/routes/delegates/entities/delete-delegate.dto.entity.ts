import { DeleteDelegateDtoSchema } from '@/routes/delegates/entities/schemas/delete-delegate.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class DeleteDelegateDto
  implements z.infer<typeof DeleteDelegateDtoSchema>
{
  @ApiProperty()
  delegate!: `0x${string}`;
  @ApiProperty()
  delegator!: `0x${string}`;
  @ApiProperty()
  signature!: string;
}
