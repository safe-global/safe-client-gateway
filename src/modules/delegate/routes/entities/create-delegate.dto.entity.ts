import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { z } from 'zod';
import type { CreateDelegateDtoSchema } from '@/modules/delegate/routes/entities/schemas/create-delegate.dto.schema';

export class CreateDelegateDto implements z.infer<
  typeof CreateDelegateDtoSchema
> {
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
