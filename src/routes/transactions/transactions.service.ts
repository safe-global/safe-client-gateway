import { Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction as DomainMultisigTransaction } from '../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../domain/safe/entities/safe.entity';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { Page } from '../common/entities/page.entity';
import {
  CustomTxInfo,
  ExecutionInfo,
  MultisigTransaction,
  TransactionSummary,
  TxInfo,
} from './entities/multisig-transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
  ) {}

  async getMultiSigTransactions(
    chainId: string,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    executed?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    const multisigTransactions =
      await this.safeRepository.getMultiSigTransactions(
        chainId,
        safeAddress,
        executionDateGte,
        executionDateLte,
        to,
        value,
        nonce,
        executed,
        limit,
        offset,
      );

    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);

    return {
      ...multisigTransactions,
      results: multisigTransactions.results.map((multiSignTransaction) => ({
        type: 'TRANSACTION',
        transaction: this.getSummary(multiSignTransaction, safeInfo),
        conflictType: 'None',
      })),
    };
  }

  private getSummary(
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): TransactionSummary {
    const txStatus = this.getTxStatus(multiSignTransaction, safeInfo);
    const txInfo = this.getTxInfo(multiSignTransaction);

    return {
      id: `multisig_${multiSignTransaction.safe}_${multiSignTransaction.safeTxHash}`,
      timestamp:
        multiSignTransaction?.executionDate?.getTime() ??
        multiSignTransaction?.submissionDate?.getTime(),
      txStatus,
      txInfo,
      executionInfo: this.getExecutionInfo(
        multiSignTransaction,
        safeInfo,
        txStatus,
      ),
    };
  }

  private getTxStatus(
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): string {
    if (multiSignTransaction.isExecuted) {
      if (multiSignTransaction.isSuccessful) {
        return 'SUCCESS';
      } else {
        return 'FAILED';
      }
    }
    if (safeInfo.nonce > multiSignTransaction.nonce) {
      return 'CANCELLED';
    }
    if (
      this.getConfirmationsCount(multiSignTransaction) <
      this.getConfirmationsRequired(multiSignTransaction, safeInfo)
    ) {
      return 'AWAITING_CONFIRMATIONS';
    }
    return 'AWAITING_EXECUTION';
  }

  private getConfirmationsCount(
    multiSignTransaction: DomainMultisigTransaction,
  ): number {
    return multiSignTransaction.confirmations?.length ?? 0;
  }

  private getConfirmationsRequired(
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): number {
    return multiSignTransaction.confirmationsRequired ?? safeInfo.threshold;
  }

  private getExecutionInfo(
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
    txStatus: string,
  ): ExecutionInfo {
    const executionInfo = {
      type: 'MULTISIG',
      nonce: multiSignTransaction.nonce,
      confirmationsRequired: this.getConfirmationsRequired(
        multiSignTransaction,
        safeInfo,
      ),
      confirmationsSubmitted: this.getConfirmationsCount(multiSignTransaction),
    };

    if (txStatus === 'AWAITING_CONFIRMATIONS') {
      return {
        ...executionInfo,
        missingSigners: this.getMissingSigners(
          multiSignTransaction,
          safeInfo,
          txStatus,
        ),
      };
    }

    return executionInfo;
  }

  private getMissingSigners(
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
    txStatus: string,
  ): string[] {
    console.log(multiSignTransaction, safeInfo, txStatus);
    const confirmedOwners =
      multiSignTransaction.confirmations?.map(
        (confirmation) => confirmation.owner,
      ) ?? [];

    return safeInfo.owners.filter((owner) => !confirmedOwners.includes(owner));
  }

  private getTxInfo(multiSignTransaction: DomainMultisigTransaction): TxInfo {
    const value = Number(multiSignTransaction?.value) || 0;
    const dataSize = multiSignTransaction.data
      ? (Buffer.byteLength(multiSignTransaction.data) - 2) / 2
      : 0;

    return <TxInfo>{
      ...this.getCustomTxInfo(value, dataSize),
    };
  }

  private getCustomTxInfo(value: number, dataSize: number): CustomTxInfo {
    return {
      type: 'Custom', // TODO:
      to: {},
      dataSize: dataSize.toString(),
      value: value.toString(),
      methodName: 'todo',
      actionCount: 1, // TODO:
      isCancellation: false, // TODO:
    };
  }
}
