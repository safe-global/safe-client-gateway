import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { Transaction } from '../../entities/transaction.entity';
import { MultisigTransactionExecutionInfoMapper } from './multisig-transaction-execution-info.mapper';
import { MultisigTransactionInfoMapper } from './transaction-info/multisig-transaction-info.mapper';
import { MultisigTransactionStatusMapper } from './multisig-transaction-status.mapper';

@Injectable()
export class MultisigTransactionMapper {
  constructor(
    private readonly statusMapper: MultisigTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly executionInfoMapper: MultisigTransactionExecutionInfoMapper,
  ) {}

  async mapTransaction(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<Transaction> {
    const txStatus = this.statusMapper.mapTransactionStatus(transaction, safe);
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      transaction,
      safe,
    );
    const executionInfo = this.executionInfoMapper.mapExecutionInfo(
      transaction,
      safe,
      txStatus,
    );
    const timestamp = transaction.executionDate ?? transaction.submissionDate;

    return new Transaction(
      `multisig_${transaction.safe}_${transaction.safeTxHash}`,
      timestamp?.getTime() ?? null,
      txStatus,
      txInfo,
      executionInfo,
      null, // TODO: include safeAppInfo retrieval logic where needed
    );
  }
}
