import { ApiProperty } from '@nestjs/swagger';

export class AuthNonce {
  @ApiProperty()
  nonce!: string;
}
