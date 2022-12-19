import { Injectable } from '@nestjs/common';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { Transaction } from '../../entities/transaction.entity';
import { MultisigTransactionInfoMapper } from './transaction-info/multisig-transaction-info.mapper';
import { ModuleTransactionStatusMapper } from './module-transaction-status.mapper';
import { ModuleTransaction } from '../../../../domain/safe/entities/module-transaction.entity';

@Injectable()
export class ModuleTransactionMapper {
  constructor(
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
    //TODO executionInfo = contractInfo(transaction.module)
    const executionInfo = undefined;

    return new Transaction(
      `module_${transaction.safe}_${transaction.transactionHash}`,
      transaction.executionDate.getTime(),
      txStatus,
      txInfo,
      executionInfo,
      null, // TODO: include safeAppInfo retrieval logic where needed
    );
  }
}
