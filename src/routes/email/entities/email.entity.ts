import { ApiProperty } from '@nestjs/swagger';

export class Email {
  @ApiProperty()
  email: string;

  @ApiProperty()
  verified: boolean;

  constructor(email: string, verified: boolean) {
    this.email = email;
    this.verified = verified;
  }
}
