import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDelegateDto {
  @ApiPropertyOptional()
  safe?: string;
  @ApiProperty()
  delegate: string;
  @ApiProperty()
  delegator: string;
  @ApiProperty()
  signature: string;
  @ApiProperty()
  label: string;

  constructor(
    delegate: string,
    delegator: string,
    signature: string,
    label: string,
    safe?: string,
  ) {
    this.safe = safe;
    this.delegate = delegate;
    this.delegator = delegator;
    this.signature = signature;
    this.label = label;
  }
}
