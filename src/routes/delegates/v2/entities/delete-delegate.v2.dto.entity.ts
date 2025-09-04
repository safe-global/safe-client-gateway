import { DeleteDelegateV2DtoSchema } from '@/routes/delegates/v2/entities/schemas/delete-delegate.v2.dto.schema';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import type { Address } from 'viem';

export class DeleteDelegateV2Dto
  implements z.infer<typeof DeleteDelegateV2DtoSchema>
{
  @ApiPropertyOptional({ type: String, nullable: true })
  delegator!: Address | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  safe!: Address | null;
  @ApiProperty()
  signature!: string;
}
