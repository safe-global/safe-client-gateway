import { ApiProperty } from '@nestjs/swagger';

export class SafeAppInfo {
  @ApiProperty()
  name: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  logo_uri: string;

  constructor(name: string, url: string, logoUri: string) {
    this.name = name;
    this.url = url;
    this.logo_uri = logoUri;
  }
}
