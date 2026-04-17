// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { z } from 'zod';
import type { DeleteSafeDelegateDtoSchema } from '@/modules/delegate/routes/entities/schemas/delete-safe-delegate.dto.schema';

export class DeleteSafeDelegateDto implements z.infer<
  typeof DeleteSafeDelegateDtoSchema
> {
  @ApiProperty()
  delegate!: Address;
  @ApiProperty()
  safe!: Address;
  @ApiProperty()
  signature!: Address;
}
