import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailDto {
  @ApiProperty()
  account: string;

  @ApiProperty()
  emailAddress: string;
}
