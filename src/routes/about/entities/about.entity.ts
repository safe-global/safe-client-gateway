import { ApiProperty } from '@nestjs/swagger';

export class About {
  @ApiProperty()
  name: string;
  @ApiProperty()
  version: string;
  @ApiProperty()
  buildNumber: string;
}
