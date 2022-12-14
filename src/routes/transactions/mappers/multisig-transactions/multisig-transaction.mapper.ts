import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { ExecutionInfo } from '../../entities/execution-info.entity';
import { MultisigExecutionInfo } from '../../entities/multisig-execution-info.entity';
import { Transaction } from '../../entities/transaction.entity';
import { MultisigTransactionInfoMapper } from './multisig-transaction-info.mapper';
import { MultisigTransactionStatusMapper } from './multisig-transaction-status.mapper';

@Injectable()
export class MultisigTransactionMapper {
  constructor(
    private readonly multisigTransactionStatusMapper: MultisigTransactionStatusMapper,
    private readonly multisigTransactionInfoMapper: MultisigTransactionInfoMapper,
  ) {}

  async mapTransaction(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<Transaction> {
    const txStatus = this.multisigTransactionStatusMapper.mapTransactionStatus(
      transaction,
      safe,
    );
    const txInfo = await this.multisigTransactionInfoMapper.mapTransactionInfo(
      chainId,
      transaction,
      safe,
    );
    const executionInfo = this.mapExecutionInfo(transaction, safe, txStatus);

    return new Transaction(
      `multisig_${transaction.safe}_${transaction.safeTxHash}`,
      transaction.executionDate.getTime(),
      txStatus,
      txInfo,
      executionInfo,
      null, // TODO: include safeAppInfo retrieval logic where needed
    );
  }

  private getMissingSigners(
    transaction: MultisigTransaction,
    safe: Safe,
  ): AddressInfo[] {
    const confirmedOwners =
      transaction.confirmations?.map((confirmation) => confirmation.owner) ??
      [];

    return safe.owners
      .filter((owner) => !confirmedOwners.includes(owner))
      .map((missingSigner) => ({ value: missingSigner }));
  }

  private mapExecutionInfo(
    transaction: MultisigTransaction,
    safe: Safe,
    txStatus: string,
  ): ExecutionInfo {
    const missingSigners =
      txStatus === 'AWAITING_CONFIRMATIONS'
        ? this.getMissingSigners(transaction, safe)
        : null;

    return new MultisigExecutionInfo(
      transaction.nonce,
      transaction.confirmationsRequired ?? safe.threshold,
      transaction.confirmations?.length || 0,
      missingSigners,
    );
  }
}
