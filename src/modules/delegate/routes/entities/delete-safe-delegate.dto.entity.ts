import { DeleteSafeDelegateDtoSchema } from '@/modules/delegate/routes/entities/schemas/delete-safe-delegate.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Address } from 'viem';

export class DeleteSafeDelegateDto
  implements z.infer<typeof DeleteSafeDelegateDtoSchema>
{
  @ApiProperty()
  delegate!: Address;
  @ApiProperty()
  safe!: Address;
  @ApiProperty()
  signature!: Address;
}
