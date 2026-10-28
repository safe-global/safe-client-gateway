// SPDX-License-Identifier: FSL-1.1-MIT
import type { DataDecoded } from '#/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { Transaction } from '#/modules/safe/domain/entities/transaction.entity';

export type DecodedTransaction<T extends Transaction = Transaction> = {
  transaction: T;
  dataDecoded: DataDecoded | null;
};
