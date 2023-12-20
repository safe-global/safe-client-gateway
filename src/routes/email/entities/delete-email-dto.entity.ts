import { ApiProperty } from '@nestjs/swagger';

export class DeleteEmailDto {
  @ApiProperty()
  account: string;

  @ApiProperty()
  timestamp: number;

  @ApiProperty()
  signature: string;
}
