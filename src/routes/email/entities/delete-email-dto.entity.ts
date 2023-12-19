import { ApiProperty } from '@nestjs/swagger';

export class DeleteEmailDto {
  @ApiProperty()
  account: string;

  @ApiProperty()
  emailAddress: string;
}
