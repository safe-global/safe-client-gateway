import { GetDelegateDtoSchema } from '@/modules/delegate/routes/entities/schemas/get-delegate.dto.schema';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import type { Address } from 'viem';

export class GetDelegateDto implements z.infer<typeof GetDelegateDtoSchema> {
  @ApiPropertyOptional()
  safe?: Address;
  @ApiPropertyOptional()
  delegate?: Address;
  @ApiPropertyOptional()
  delegator?: Address;
  @ApiPropertyOptional()
  label?: string;

  constructor(
    safe?: Address,
    delegate?: Address,
    delegator?: Address,
    label?: string,
  ) {
    this.safe = safe;
    this.delegate = delegate;
    this.delegator = delegator;
    this.label = label;
  }
}
