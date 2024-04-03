import { ApiProperty } from '@nestjs/swagger';
import {
  Transfer,
  TransferType,
} from '@/routes/transactions/entities/transfers/transfer.entity';

export class NativeCoinTransfer extends Transfer {
  @ApiProperty()
  value: string | null;

  constructor(value: string | null) {
    super(TransferType.NativeCoin);
    this.value = value;
  }
}
