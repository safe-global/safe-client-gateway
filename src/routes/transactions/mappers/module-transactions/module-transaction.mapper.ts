import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { Injectable } from '@nestjs/common';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { Transaction } from '../../entities/transaction.entity';
import { MultisigTransactionInfoMapper } from '../common/transaction-info.mapper';
import { ModuleTransactionStatusMapper } from './module-transaction-status.mapper';
import { ModuleTransaction } from '../../../../domain/safe/entities/module-transaction.entity';
import { ModuleExecutionInfo } from '../../entities/module-execution-info.entity';

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
    safe: Safe,
  ): Promise<Transaction> {
    const txStatus = this.statusMapper.mapTransactionStatus(transaction);
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      transaction,
      safe,
    );
    const executionInfo = new ModuleExecutionInfo(
      await this.addressInfoHelper.getOrDefault(chainId, transaction.module),
    );
    return new Transaction(
      transaction.moduleTransactionId,
      transaction.executionDate.getTime(),
      txStatus,
      txInfo,
      executionInfo,
      null, // TODO: include safeAppInfo retrieval logic where needed
    );
  }
}
