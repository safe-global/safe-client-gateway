// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { z } from 'zod';
import type { UpdateDelegateV3DtoSchema } from '@/modules/delegate/routes/v3/entities/schemas/update-delegate.v3.dto.schema';

export class UpdateDelegateV3Dto
  implements z.infer<typeof UpdateDelegateV3DtoSchema>
{
  @ApiPropertyOptional({ type: String, nullable: true })
  safe!: Address | null;
  @ApiProperty()
  delegate!: Address;
  @ApiProperty()
  delegator!: Address;
  @ApiProperty()
  signature!: string;
  @ApiProperty()
  label!: string;
}
