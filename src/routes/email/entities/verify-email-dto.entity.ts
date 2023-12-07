import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty()
  account: string;

  @ApiProperty()
  code: string;
}
