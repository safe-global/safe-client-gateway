// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { CreationTransaction } from '@/modules/safe/domain/entities/creation-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { CreationTransactionInfo } from '@/modules/transactions/routes/entities/creation-transaction-info.entity';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';

@Injectable()
export class CreationTransactionMapper {
  private static readonly TRANSACTION_TYPE = 'creation';

  constructor(private readonly addressInfoHelper: AddressInfoHelper) {}

  async mapTransaction(
    chainId: string,
    transaction: CreationTransaction,
    safe: Safe,
  ): Promise<Transaction> {
    const creator = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.creator,
      ['CONTRACT'],
    );
    const implementation = transaction.masterCopy
      ? await this.addressInfoHelper.getOrDefault(
          chainId,
          transaction.masterCopy,
          ['CONTRACT'],
        )
      : null;
    const factory = await this.addressInfoHelper.getOrDefault(
      chainId,
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
