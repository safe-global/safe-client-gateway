import { DeleteDelegateDtoSchema } from '@/modules/delegate/routes/entities/schemas/delete-delegate.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Address } from 'viem';

export class DeleteDelegateDto
  implements z.infer<typeof DeleteDelegateDtoSchema>
{
  @ApiProperty()
  delegate!: Address;
  @ApiProperty()
  delegator!: Address;
  @ApiProperty()
  signature!: string;
}
