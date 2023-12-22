import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailDto {
  @ApiProperty()
  emailAddress: string;

  @ApiProperty()
  account: string;

  @ApiProperty()
  timestamp: number;

  @ApiProperty()
  signature: string;
}
