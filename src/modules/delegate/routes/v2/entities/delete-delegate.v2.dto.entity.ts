// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { z } from 'zod';
import type { DeleteDelegateV2DtoSchema } from '@/modules/delegate/routes/v2/entities/schemas/delete-delegate.v2.dto.schema';

export class DeleteDelegateV2Dto implements z.infer<
  typeof DeleteDelegateV2DtoSchema
> {
  @ApiPropertyOptional({ type: String, nullable: true })
  delegator!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  safe!: Address | null;
  @ApiProperty()
  signature!: string;
}
