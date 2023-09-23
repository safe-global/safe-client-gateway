import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { Injectable } from '@nestjs/common';
import { Transaction } from '../../entities/transaction.entity';
import { MultisigTransactionInfoMapper } from '../common/transaction-info.mapper';
import { ModuleTransactionStatusMapper } from './module-transaction-status.mapper';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { ModuleExecutionInfo } from '../../entities/module-execution-info.entity';
import {
  MODULE_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '../../constants';

@Injectable()
export class ModuleTransactionMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly statusMapper: ModuleTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
  ) {}

  async mapTransaction(
    chainId: string,
    transaction: ModuleTransaction,
  ): Promise<Transaction> {
    const txStatus = this.statusMapper.mapTransactionStatus(transaction);
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      transaction,
    );
    const executionInfo = new ModuleExecutionInfo(
      await this.addressInfoHelper.getOrDefault(chainId, transaction.module, [
        'CONTRACT',
      ]),
    );
    return new Transaction(
      `${MODULE_TRANSACTION_PREFIX}${TRANSACTION_ID_SEPARATOR}${transaction.safe}${TRANSACTION_ID_SEPARATOR}${transaction.moduleTransactionId}`,
      transaction.executionDate.getTime(),
      txStatus,
      txInfo,
      executionInfo,
      null,
    );
  }
}
