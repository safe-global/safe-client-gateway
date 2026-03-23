// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';

export class SafeQueuedTransaction {
  @ApiProperty()
  readonly safeAddress: string;
  @ApiProperty()
  readonly chainId: string;
  @ApiProperty()
  readonly transaction: Transaction;

  constructor(safeAddress: string, chainId: string, transaction: Transaction) {
    this.safeAddress = safeAddress;
    this.chainId = chainId;
    this.transaction = transaction;
  }
}
