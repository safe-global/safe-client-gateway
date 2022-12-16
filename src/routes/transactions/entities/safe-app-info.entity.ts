import { ApiProperty } from '@nestjs/swagger';

export class SafeAppInfo {
  @ApiProperty()
  name: string;
  @ApiProperty()
  url: string;
  @ApiProperty()
  logo_uri: string;
}
