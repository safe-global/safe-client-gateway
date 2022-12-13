import { ApiProperty } from '@nestjs/swagger';

export class TransactionInfo {
  @ApiProperty()
  type: string;

  protected constructor(type: string) {
    this.type = type;
  }
}
