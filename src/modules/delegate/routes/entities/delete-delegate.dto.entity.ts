// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { z } from 'zod';
import type { DeleteDelegateDtoSchema } from '@/modules/delegate/routes/entities/schemas/delete-delegate.dto.schema';

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
