import { ApiProperty } from '@nestjs/swagger';

export class RecommendedNonce {
  @ApiProperty()
  readonly nonce: number;

  constructor(nonce: number) {
    this.nonce = nonce;
  }
}
