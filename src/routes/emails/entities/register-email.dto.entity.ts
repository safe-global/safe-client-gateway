import { ApiProperty } from '@nestjs/swagger';

export class RegisterEmailDto {
  @ApiProperty()
  emailAddress: string;
  @ApiProperty()
  signature: string;
  @ApiProperty()
  timestamp: number;
}
