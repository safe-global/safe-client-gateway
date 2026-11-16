// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { CreationTransaction } from '#/modules/safe/domain/entities/creation-transaction.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { CreationTransactionInfo } from '#/modules/transactions/routes/entities/creation-transaction-info.entity';
import { Transaction } from '#/modules/transactions/routes/entities/transaction.entity';
import { TransactionStatus } from '#/modules/transactions/routes/entities/transaction-status.entity';
import type { AddressLookups } from '#/routes/common/address-info/address-lookups';

@Injectable()
export class CreationTransactionMapper {
  private static readonly TRANSACTION_TYPE = 'creation';

  async mapTransaction(
    addressLookups: AddressLookups,
    transaction: CreationTransaction,
    safe: Safe,
  ): Promise<Transaction> {
    const creator = await addressLookups.getOrDefault(transaction.creator, [
      'CONTRACT',
    ]);
    const implementation = transaction.masterCopy
      ? await addressLookups.getOrDefault(transaction.masterCopy, ['CONTRACT'])
      : null;
    const factory = await addressLookups.getOrDefault(
      transaction.factoryAddress,
      ['CONTRACT'],
    );
    const txInfo = new CreationTransactionInfo(
      creator,
      transaction.transactionHash,
      implementation,
      factory,
      transaction.saltNonce,
    );

    return new Transaction(
      `${CreationTransactionMapper.TRANSACTION_TYPE}_${safe.address}`,
      transaction.created.getTime(),
      TransactionStatus.Success,
      txInfo,
      null,
      null,
      null,
      transaction.transactionHash,
    );
  }
}
