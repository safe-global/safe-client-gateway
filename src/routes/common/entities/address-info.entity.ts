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
    this.name = name?.length === 0 ? null : name;
    this.logoUri = logoUri;
  }
}
