import { GetDelegateDtoSchema } from '@/routes/delegates/entities/schemas/get-delegate.dto.schema';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class GetDelegateDto implements z.infer<typeof GetDelegateDtoSchema> {
  @ApiPropertyOptional()
  safe?: `0x${string}`;
  @ApiPropertyOptional()
  delegate?: `0x${string}`;
  @ApiPropertyOptional()
  delegator?: `0x${string}`;
  @ApiPropertyOptional()
  label?: string;

  constructor(
    safe?: `0x${string}`,
    delegate?: `0x${string}`,
    delegator?: `0x${string}`,
    label?: string,
  ) {
    this.safe = safe;
    this.delegate = delegate;
    this.delegator = delegator;
    this.label = label;
  }
}
