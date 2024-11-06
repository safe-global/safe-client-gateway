import { ApiProperty } from '@nestjs/swagger';

export class RelaysRemaining {
  @ApiProperty()
  remaining: number;

  @ApiProperty()
  limit: number;

  constructor({ remaining, limit }: { remaining: number; limit: number }) {
    this.remaining = remaining;
    this.limit = limit;
  }
}
