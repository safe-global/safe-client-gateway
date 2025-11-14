import { Injectable } from '@nestjs/common';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { CreationTransactionInfo } from '@/modules/transactions/routes/entities/creation-transaction-info.entity';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';

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
