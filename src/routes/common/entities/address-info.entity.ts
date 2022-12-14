import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressInfo {
  @ApiProperty()
  readonly value: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  readonly name: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  readonly logoUri: string | null;

  constructor(value: string, name?: string, logoUri?: string) {
    this.value = value;
    this.name = name || null;
    this.logoUri = logoUri || null;
  }
}
