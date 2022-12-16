import { ApiProperty } from '@nestjs/swagger';
import { Transfer } from './transfer.entity';

export class NativeCoinTransfer extends Transfer {
  @ApiProperty()
  value: string;

  constructor(value: string) {
    super('NATIVE_COIN');
    this.value = value;
  }
}
