import { Injectable } from '@nestjs/common';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { ConflictType } from '../../entities/conflict-type.entity';
import { MultisigExecutionInfo } from '../../entities/multisig-execution-info.entity';
import { MultisigTransaction } from '../../entities/multisig-transaction.entity';
import { QueuedItem } from '../../entities/queued-item.entity';
import { ConflictHeaderQueuedItem } from '../../entities/queued-items/conflict-header-queued-item.entity';
import {
  LabelItem,
  LabelQueuedItem,
} from '../../entities/queued-items/label-queued-item.entity';
import { TransactionGroup } from '../../entities/queued-items/transaction-group.entity';
import { Transaction } from '../../entities/transaction.entity';
import { MultisigTransactionMapper } from '../multisig-transactions/multisig-transaction.mapper';

@Injectable()
export class QueuedItemsMapper {
  constructor(private readonly mapper: MultisigTransactionMapper) {}

  async getQueuedItems(
    chainId: string,
    transactions: Transaction[],
    safe: Safe,
    previousPageLastNonce: number | null,
    nextPageFirstNonce: number | null,
  ): Promise<QueuedItem[]> {
    const transactionGroups = this.groupByNonce(transactions);
    return this.buildItems(
      safe,
      transactionGroups,
      previousPageLastNonce,
      nextPageFirstNonce,
    );
  }

  private buildItems(
    safe: Safe,
    transactionGroups: TransactionGroup[],
    previousPageLastNonce: number | null,
    nextPageFirstNonce: number | null,
  ): QueuedItem[] {
    let items: QueuedItem[] = [];
    let lastProcessedNonce: number;
    lastProcessedNonce = previousPageLastNonce ?? -1;

    transactionGroups.forEach((transactionGroup) => {
      const { nonce } = transactionGroup;
      if (lastProcessedNonce < safe.nonce && nonce === safe.nonce) {
        items.push(new LabelQueuedItem(LabelItem.Next));
      } else if (lastProcessedNonce <= safe.nonce && nonce > safe.nonce) {
        items.push(new LabelQueuedItem(LabelItem.Queued));
      }
      lastProcessedNonce = nonce;

      const isEdgeGroup = nonce === nextPageFirstNonce;
      const conflictFromPreviousPage = nonce === previousPageLastNonce;
      const hasConflicts =
        transactionGroup.transactions.length > 1 || isEdgeGroup;
      if (hasConflicts && !conflictFromPreviousPage) {
        items.push(new ConflictHeaderQueuedItem(nonce));
      }

      items = [
        ...items,
        ...this.getMappedTransactionGroup(
          hasConflicts,
          conflictFromPreviousPage,
          isEdgeGroup,
          transactionGroup,
        ),
      ];
    });

    return items;
  }

  private getMappedTransactionGroup(
    hasConflicts: boolean,
    conflictFromPreviousPage: boolean,
    isEdgeGroup: boolean,
    transactionGroup: TransactionGroup,
  ): MultisigTransaction[] {
    const firstItem = this.getAsFirstTransaction(
      hasConflicts,
      conflictFromPreviousPage,
      transactionGroup.transactions[0],
    );
    const remainingItems = this.getAsNonFirstTransactions(
      isEdgeGroup,
      transactionGroup.transactions.slice(1),
    );
    return [firstItem, ...remainingItems];
  }

  private getAsFirstTransaction(
    hasConflicts: boolean,
    conflictFromPreviousPage: boolean,
    transaction: Transaction,
  ): MultisigTransaction {
    let firstItemConflictType: ConflictType;

    if (hasConflicts) {
      firstItemConflictType = ConflictType.HasNext;
    } else if (conflictFromPreviousPage) {
      firstItemConflictType = ConflictType.End;
    } else {
      firstItemConflictType = ConflictType.None;
    }

    return new MultisigTransaction(transaction, firstItemConflictType);
  }

  private getAsNonFirstTransactions(
    isEdgeGroup: boolean,
    transactions: Transaction[],
  ): MultisigTransaction[] {
    return transactions.map((transaction, index) => {
      const isLastInGroup = index === transactions.length - 1;
      const conflictType =
        !isLastInGroup || isEdgeGroup ? ConflictType.HasNext : ConflictType.End;
      return new MultisigTransaction(transaction, conflictType);
    });
  }

  private groupByNonce(transactions: Transaction[]): TransactionGroup[] {
    const groups = transactions.reduce((result, transaction) => {
      const executionInfo = transaction?.executionInfo as MultisigExecutionInfo;
      return {
        ...result,
        [executionInfo['nonce']]: [
          ...(result[executionInfo['nonce']] || []),
          transaction,
        ],
      };
    }, {});

    return Object.entries(groups).map((group) => ({
      nonce: Number(group[0]),
      transactions: group[1] as Transaction[],
    }));
  }
}
