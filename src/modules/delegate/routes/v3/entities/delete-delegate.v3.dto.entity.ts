// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { z } from 'zod';
import type { DeleteDelegateV3DtoSchema } from '@/modules/delegate/routes/v3/entities/schemas/delete-delegate.v3.dto.schema';

export class DeleteDelegateV3Dto
  implements z.infer<typeof DeleteDelegateV3DtoSchema>
{
  @ApiPropertyOptional({ type: String, nullable: true })
  delegator!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  safe!: Address | null;
  @ApiProperty()
  signature!: string;
}
