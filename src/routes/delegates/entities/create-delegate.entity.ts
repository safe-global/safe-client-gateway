import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { isHex } from '../../common/utils/utils';

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

export function isCreateDelegateDto(
  dto: CreateDelegateDto,
): dto is CreateDelegateDto {
  if (!dto.safe) {
    return (
      isHex(dto.delegate) &&
      isHex(dto.delegator) &&
      isHex(dto.signature) &&
      typeof dto.label === 'string'
    );
  } else {
    return (
      isHex(dto.delegate) &&
      isHex(dto.delegator) &&
      isHex(dto.signature) &&
      isHex(dto.safe) &&
      typeof dto.label === 'string'
    );
  }
}
