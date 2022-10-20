import { ApiPropertyOptional } from '@nestjs/swagger';

export class DelegateParamsDto {
  @ApiPropertyOptional()
  safe?: string;
  @ApiPropertyOptional()
  delegate?: string;
  @ApiPropertyOptional()
  delegator?: string;
  @ApiPropertyOptional()
  label?: string;

  constructor(
    safe?: string,
    delegate?: string,
    delegator?: string,
    label?: string,
  ) {
    this.safe = safe;
    this.delegate = delegate;
    this.delegator = delegator;
    this.label = label;
  }
}
