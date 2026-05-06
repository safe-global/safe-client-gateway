// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { ConflictType } from '@/modules/transactions/routes/entities/conflict-type.entity';
import type { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';

export class MultisigTransaction {
  @ApiProperty({ enum: ['TRANSACTION'] })
  type: string;
  @ApiProperty()
  transaction: Transaction;
  @ApiProperty({ enum: ConflictType })
  conflictType: string;

  constructor(transaction: Transaction, conflictType: ConflictType) {
    this.type = 'TRANSACTION';
    this.transaction = transaction;
    this.conflictType = conflictType;
  }
}
