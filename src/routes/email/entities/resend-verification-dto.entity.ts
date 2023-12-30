import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationDto {
  @ApiProperty()
  account: string;
}
