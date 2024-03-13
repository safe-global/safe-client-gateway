import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SafeAppInfo {
  @ApiProperty()
  name: string;
  @ApiProperty()
  url: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;

  constructor(name: string, url: string, logoUri: string | null) {
    this.name = name;
    this.url = url;
    this.logoUri = logoUri;
  }
}
