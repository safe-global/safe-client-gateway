import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressInfo {
  @ApiProperty()
  readonly value: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  readonly name: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  readonly logoUri: string | null;

  constructor(
    value: string,
    name: string | null = null,
    logoUri: string | null = null,
  ) {
    this.value = value;
    this.name = name === '' ? null : name;
    this.logoUri = logoUri === '' ? null : logoUri;
  }
}
