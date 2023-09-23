import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { Injectable } from '@nestjs/common';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { CreationTransactionInfo } from '../../entities/creation-transaction-info.entity';

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
    );
    return new Transaction(
      `${CreationTransactionMapper.TRANSACTION_TYPE}_${safe.address}`,
      transaction.created.getTime(),
      TransactionStatus.Success,
      txInfo,
      null,
      null,
    );
  }
}
