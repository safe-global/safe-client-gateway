import { Injectable } from '@nestjs/common';
import { flatten, groupBy } from 'lodash';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { Page } from '../../../common/entities/page.entity';
import { ConflictType } from '../../entities/conflict-type.entity';
import { QueuedItem } from '../../entities/queued-item.entity';
import { ConflictHeaderQueuedItem } from '../../entities/queued-items/conflict-header-queued-item.entity';
import {
  LabelItem,
  LabelQueuedItem,
} from '../../entities/queued-items/label-queued-item.entity';
import { TransactionQueuedItem } from '../../entities/queued-items/transaction-queued-item.entity';
import { MultisigTransactionMapper } from '../multisig-transactions/multisig-transaction.mapper';

class TransactionGroup {
  nonce: number;
  transactions: MultisigTransaction[];
}

@Injectable()
export class QueuedItemsMapper {
  constructor(private readonly mapper: MultisigTransactionMapper) {}

  async getQueuedItems(
    transactions: Page<MultisigTransaction>,
    safe: Safe,
    chainId: string,
    previousPageLastNonce: number | null,
    nextPageFirstNonce: number | null,
    timezoneOffset: number,
  ): Promise<QueuedItem[]> {
    const transactionGroups = this.groupByNonce(
      this.getTimezoneOffsetTransactions(transactions.results, timezoneOffset),
    );
    let lastProcessedNonce = previousPageLastNonce ?? -1;

    return flatten(
      await Promise.all(
        transactionGroups.map(async (transactionGroup) => {
          const transactionGroupItems: QueuedItem[] = [];
          const { nonce } = transactionGroup;
          if (lastProcessedNonce < safe.nonce && nonce === safe.nonce) {
            transactionGroupItems.push(new LabelQueuedItem(LabelItem.Next));
          } else if (lastProcessedNonce <= safe.nonce && nonce > safe.nonce) {
            transactionGroupItems.push(new LabelQueuedItem(LabelItem.Queued));
          }
          lastProcessedNonce = nonce;

          const isEdgeGroup = nonce === nextPageFirstNonce;
          const isSingleItemGroup = transactionGroup.transactions.length === 1;
          const conflictFromPreviousPage = nonce === previousPageLastNonce;
          const hasConflicts = !isSingleItemGroup || isEdgeGroup;
          if (hasConflicts && !conflictFromPreviousPage) {
            transactionGroupItems.push(new ConflictHeaderQueuedItem(nonce));
          }

          const mappedTransactionItems = await this.getMappedTransactionGroup(
            chainId,
            safe,
            hasConflicts,
            conflictFromPreviousPage,
            isEdgeGroup,
            transactionGroup,
          );

          transactionGroupItems.push(...mappedTransactionItems);
          return transactionGroupItems;
        }),
      ),
    );
  }

  private async getMappedTransactionGroup(
    chainId: string,
    safe: Safe,
    hasConflicts: boolean,
    conflictFromPreviousPage: boolean,
    isEdgeGroup: boolean,
    transactionGroup: TransactionGroup,
  ): Promise<TransactionQueuedItem[]> {
    return Promise.all(
      transactionGroup.transactions.map(async (transaction, idx) => {
        const isFirstInGroup = idx === 0;
        const isLastInGroup = idx === transactionGroup.transactions.length - 1;
        return new TransactionQueuedItem(
          await this.mapper.mapTransaction(chainId, transaction, safe),
          this.getConflictType(
            isFirstInGroup,
            isLastInGroup,
            hasConflicts,
            conflictFromPreviousPage,
            isEdgeGroup,
          ),
        );
      }),
    );
  }

  private getConflictType(
    isFirstInGroup: boolean,
    isLastInGroup: boolean,
    hasConflicts: boolean,
    conflictFromPreviousPage: boolean,
    isEdgeGroup: boolean,
  ): ConflictType {
    if (isFirstInGroup) {
      if (hasConflicts) {
        return ConflictType.HasNext;
      } else if (conflictFromPreviousPage) {
        return ConflictType.End;
      } else {
        return ConflictType.None;
      }
    }
    return !isLastInGroup || isEdgeGroup
      ? ConflictType.HasNext
      : ConflictType.End;
  }

  /**
   * Divides an array of transactions in groups with the same nonce.
   * Each TransactionGroup will contain at least one transaction.
   * @param transactions transactions with potentially different nonces.
   * @returns Array<TransactionGroup> in which each group of transactions has a different nonce.
   */
  private groupByNonce(
    transactions: MultisigTransaction[],
  ): TransactionGroup[] {
    return Object.entries(groupBy(transactions, 'nonce')).map(
      ([nonce, transactions]) =>
        <TransactionGroup>{
          nonce: Number(nonce),
          transactions: transactions,
        },
    );
  }

  /**
   * Adjusts the timestamps of transactions array by given offset
   * @param transactions transactions to offset the timestamp of
   * @param timezoneOffset UTC timezone offset in milliseconds
   */
  private getTimezoneOffsetTransactions(
    transactions: MultisigTransaction[],
    timezoneOffset: number,
  ): MultisigTransaction[] {
    if (timezoneOffset === 0) {
      return transactions;
    }

    // We clone so as to not modify the original dates
    return structuredClone(transactions).map((transaction) => {
      // No need to set the `executionDate` as it will not exist in the queue
      transaction.modified?.setMilliseconds(timezoneOffset);
      transaction.submissionDate.setUTCMilliseconds(timezoneOffset);

      return transaction;
    });
  }
}
