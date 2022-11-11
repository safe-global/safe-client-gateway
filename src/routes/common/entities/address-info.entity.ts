import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressInfo {
  @ApiProperty()
  readonly value: string;
  @ApiPropertyOptional()
  readonly name?: string;
  @ApiPropertyOptional()
  readonly logoUri?: string;

  constructor(value: string, name?: string, logoUri?: string) {
    this.value = value;
    this.name = name;
    this.logoUri = logoUri;
  }
}
