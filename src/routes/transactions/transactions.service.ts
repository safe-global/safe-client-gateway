import { Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction as DomainMultisigTransaction } from '../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../domain/safe/entities/safe.entity';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { Page } from '../common/entities/page.entity';
import {
  MultisigTransaction,
  TransactionSummary,
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
    return {
      id: `multisig_${multiSignTransaction.safe}_${multiSignTransaction.safeTxHash}`,
      timestamp:
        multiSignTransaction?.executionDate?.getTime() ??
        multiSignTransaction?.submissionDate?.getTime(),
      txStatus: this.getTxStatus(multiSignTransaction, safeInfo),
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
    return multiSignTransaction.confirmations?.length ?? 0; // TODO:
  }

  private getConfirmationsRequired(
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): number {
    return multiSignTransaction.confirmationsRequired ?? safeInfo.threshold; // TODO:
  }
}
