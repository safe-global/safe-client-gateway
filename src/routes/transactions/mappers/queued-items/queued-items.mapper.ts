import { Injectable } from '@nestjs/common';
import { groupBy } from 'lodash';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { ConflictType } from '../../entities/conflict-type.entity';
import { QueuedItem } from '../../entities/queued-item.entity';
import { ConflictHeaderQueuedItem } from '../../entities/queued-items/conflict-header-queued-item.entity';
import {
  LabelItem,
  LabelQueuedItem,
} from '../../entities/queued-items/label-queued-item.entity';
import { TransactionGroup } from '../../entities/queued-items/transaction-group.entity';
import { TransactionQueuedItem } from '../../entities/queued-items/transaction-queued-item.entity';
import { Transaction } from '../../entities/transaction.entity';
import { MultisigTransactionMapper } from '../multisig-transactions/multisig-transaction.mapper';

@Injectable()
export class QueuedItemsMapper {
  constructor(private readonly mapper: MultisigTransactionMapper) {}

  async getQueuedItems(
    transactions: Transaction[],
    safe: Safe,
    previousPageLastNonce: number | null,
    nextPageFirstNonce: number | null,
  ): Promise<QueuedItem[]> {
    const transactionGroups = this.groupByNonce(transactions);
    let items: QueuedItem[] = [];
    let lastProcessedNonce = previousPageLastNonce ?? -1;

    transactionGroups.forEach((transactionGroup) => {
      const { nonce } = transactionGroup;
      if (lastProcessedNonce < safe.nonce && nonce === safe.nonce) {
        items.push(new LabelQueuedItem(LabelItem.Next));
      } else if (lastProcessedNonce <= safe.nonce && nonce > safe.nonce) {
        items.push(new LabelQueuedItem(LabelItem.Queued));
      }
      lastProcessedNonce = nonce;

      const isEdgeGroup = nonce === nextPageFirstNonce;
      const isSingleItemGroup = transactionGroup.transactions.length === 1;
      const conflictFromPreviousPage = nonce === previousPageLastNonce;
      const hasConflicts = !isSingleItemGroup || isEdgeGroup;
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
  ): TransactionQueuedItem[] {
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

  /**
   * Maps each transaction passed to the method considering it as the first item of its group.
   */
  private getAsFirstTransaction(
    hasConflicts: boolean,
    conflictFromPreviousPage: boolean,
    transaction: Transaction,
  ): TransactionQueuedItem {
    let conflictType: ConflictType;

    if (hasConflicts) {
      conflictType = ConflictType.HasNext;
    } else if (conflictFromPreviousPage) {
      conflictType = ConflictType.End;
    } else {
      conflictType = ConflictType.None;
    }

    return new TransactionQueuedItem(transaction, conflictType);
  }

  /**
   * Maps each transaction passed to the method considering it as a non-ending item of its group.
   */
  private getAsNonFirstTransactions(
    isEdgeGroup: boolean,
    transactions: Transaction[],
  ): TransactionQueuedItem[] {
    return transactions.map((transaction, index) => {
      const isLastInGroup = index === transactions.length - 1;
      const conflictType =
        !isLastInGroup || isEdgeGroup ? ConflictType.HasNext : ConflictType.End;
      return new TransactionQueuedItem(transaction, conflictType);
    });
  }

  /**
   * Divides an array of transactions in groups with the same nonce.
   * Each TransactionGroup will contain at least one transaction.
   * @param transactions transactions with potentially different nonces.
   * @returns Array<TransactionGroup> in which each group of transactions has a different nonce.
   */
  private groupByNonce(transactions: Transaction[]): TransactionGroup[] {
    return Object.entries(groupBy(transactions, 'executionInfo.nonce')).map(
      (group) => ({
        nonce: Number(group[0]),
        transactions: group[1] as Transaction[],
      }),
    );
  }
}
