import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { Injectable } from '@nestjs/common';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { Transaction } from '../../entities/transaction.entity';
import { CreationTransaction } from '../../../../domain/safe/entities/creation-transaction.entity';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { CreationTransactionInfo } from '../../entities/creation-transaction-info.entity';

@Injectable()
export class CreationTransactionMapper {
  constructor(private readonly addressInfoHelper: AddressInfoHelper) {}

  async mapTransaction(
    chainId: string,
    transaction: CreationTransaction,
    safe: Safe,
  ): Promise<Transaction> {
    const creator = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.creator,
    );
    const transactionHash = transaction.transactionHash;
    const implementation = transaction.masterCopy
      ? await this.addressInfoHelper.getOrDefault(
          chainId,
          transaction.masterCopy,
        )
      : null;
    const factory = transaction.factoryAddress
      ? await this.addressInfoHelper.getOrDefault(
          chainId,
          transaction.factoryAddress,
        )
      : null;
    const txInfo = new CreationTransactionInfo(
      creator,
      transactionHash,
      implementation,
      factory,
    );
    return new Transaction(
      `creation_${safe.address}`,
      transaction.created.getTime(),
      TransactionStatus.Success,
      txInfo,
      null,
      null,
    );
  }
}
