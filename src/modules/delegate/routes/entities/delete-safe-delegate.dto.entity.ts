// SPDX-License-Identifier: FSL-1.1-MIT
import type { DeleteSafeDelegateDtoSchema } from '@/modules/delegate/routes/entities/schemas/delete-safe-delegate.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import type { z } from 'zod';
import type { Address } from 'viem';

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
