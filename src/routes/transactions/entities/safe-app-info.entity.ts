import { ApiProperty } from '@nestjs/swagger';

export class SafeAppInfo {
  @ApiProperty()
  name: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  logoUri: string;

  constructor(name: string, url: string, logoUri: string) {
    this.name = name;
    this.url = url;
    this.logoUri = logoUri;
  }
}
