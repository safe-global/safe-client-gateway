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
    // Return null if name is an empty string
    this.name = typeof name === 'string' && name === '' ? null : name;
    // Return null if logoUri is an empty string
    this.logoUri =
      typeof logoUri === 'string' && logoUri === '' ? null : logoUri;
  }
}
