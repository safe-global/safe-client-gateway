import { Injectable } from '@nestjs/common';
import {
  isCreationTransaction,
  isEthereumTransaction,
  isModuleTransaction,
  isMultisigTransaction,
  Transaction as TransactionDomain,
} from '../../../../domain/safe/entities/transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { ModuleTransactionMapper } from '../module-transactions/module-transaction.mapper';
import { MultisigTransactionMapper } from '../multisig-transactions/multisig-transaction.mapper';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { ModuleTransaction } from '../../../../domain/safe/entities/module-transaction.entity';
import { EthereumTransaction } from '../../../../domain/safe/entities/ethereum-transaction.entity';
import { groupBy } from 'lodash';
import { IncomingTransferMapper } from '../transfers/transfer.mapper';
import { TransactionItem } from '../../entities/transaction-item.entity';
import { DateLabel } from '../../entities/date-label.entity';
import { Transfer } from '../../../../domain/safe/entities/transfer.entity';
import { CreationTransaction } from '../../../../domain/safe/entities/creation-transaction.entity';
import { CreationTransactionMapper } from '../creation-transaction/creation-transaction.mapper';

class TransactionDomainGroup {
  timestamp: number;
  transactions: (
    | MultisigTransaction
    | ModuleTransaction
    | EthereumTransaction
    | CreationTransaction
  )[];
}

@Injectable()
export class TransactionsMapper {
  constructor(
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly incomingTransferMapper: IncomingTransferMapper,
    private readonly creationTransactionMapper: CreationTransactionMapper,
  ) {}
  async mapTransactions(
    chainId: string,
    transactionsDomain: TransactionDomain[],
    safe: Safe,
    offset: number,
    timezoneOffset: number,
  ): Promise<Array<TransactionItem | DateLabel>> {
    if (transactionsDomain.length == 0) {
      return [];
    }
    const prevPageTimestamp = this.getPreviousPageDate(
      transactionsDomain,
      offset,
      timezoneOffset,
    )?.getTime();
    // Remove first item that was requested to get previous day timestamp
    if (prevPageTimestamp !== undefined) {
      transactionsDomain = transactionsDomain.slice(1);
    }
    const transactionsDomainGroups = this.groupByDay(
      transactionsDomain,
      timezoneOffset,
    );

    const transactionList = await Promise.all(
      transactionsDomainGroups.map(async (transactionGroup) => {
        const transactions: (TransactionItem | DateLabel)[] = [];
        if (transactionGroup.timestamp != prevPageTimestamp) {
          transactions.push(new DateLabel(transactionGroup.timestamp));
        }
        transactions.push(
          ...(await this.mapGroupTransactions(transactionGroup, chainId, safe)),
        );
        return transactions.flat();
      }),
    );

    return transactionList.flat();
  }

  private getTransactionTimestamp(transaction: TransactionDomain): Date {
    let timestamp: Date | null;
    if (isMultisigTransaction(transaction)) {
      const executionDate = transaction.executionDate;
      timestamp = executionDate ?? transaction.submissionDate;
    } else if (isEthereumTransaction(transaction)) {
      timestamp = transaction.executionDate;
    } else if (isModuleTransaction(transaction)) {
      timestamp = transaction.executionDate;
    } else if (isCreationTransaction(transaction)) {
      timestamp = transaction.created;
    } else {
      throw Error('Unknown transaction type');
    }
    if (timestamp == null) {
      throw Error('ExecutionDate cannot be null');
    }
    return timestamp;
  }

  private getPreviousPageDate(
    transactions: TransactionDomain[],
    offset: number,
    timezoneOffset: number,
  ): Date | undefined {
    // More than 1 element is required to get the previous page date
    if (offset <= 0 || transactions.length <= 1) return undefined;
    const previousPageTransaction = transactions[0];
    const timestamp = this.getTransactionTimestamp(previousPageTransaction);
    return this.getDayFromDate(timestamp, timezoneOffset);
  }

  private groupByDay(
    transactions: TransactionDomain[],
    timezoneOffset: number,
  ): TransactionDomainGroup[] {
    return Object.entries(
      groupBy(transactions, (transaction) => {
        const transactionTimestamp = this.getTransactionTimestamp(transaction);
        return this.getDayFromDate(
          transactionTimestamp,
          timezoneOffset,
        ).getTime();
      }),
    ).map(
      ([timestamp, transactions]) =>
        <TransactionDomainGroup>{
          timestamp: Number(timestamp),
          transactions: transactions,
        },
    );
  }

  private getDayFromDate(timestamp: Date, timezoneOffset: number): Date {
    if (timezoneOffset != 0) {
      timestamp.setUTCSeconds(timezoneOffset);
    }
    return new Date(
      Date.UTC(
        timestamp.getFullYear(),
        timestamp.getMonth(),
        timestamp.getDate(),
      ),
    );
  }

  private mapTransfer(transfers: Transfer[], chainId: string, safe: Safe) {
    return transfers.map(
      async (transfer) =>
        new TransactionItem(
          await this.incomingTransferMapper.mapTransfer(
            chainId,
            transfer,
            safe,
          ),
        ),
    );
  }

  private mapGroupTransactions(
    transactionGroup,
    chainId,
    safe,
  ): Promise<TransactionItem[]> {
    return Promise.all(
      transactionGroup.transactions.map(async (transaction) => {
        if (isMultisigTransaction(transaction)) {
          return new TransactionItem(
            await this.multisigTransactionMapper.mapTransaction(
              chainId,
              transaction as MultisigTransaction,
              safe,
            ),
          );
        } else if (isModuleTransaction(transaction)) {
          return new TransactionItem(
            await this.moduleTransactionMapper.mapTransaction(
              chainId,
              transaction as ModuleTransaction,
              safe,
            ),
          );
        } else if (isEthereumTransaction(transaction)) {
          const transfers = (transaction as EthereumTransaction).transfers;
          if (transfers != null) {
            return await Promise.all(
              this.mapTransfer(transfers, chainId, safe),
            );
          }
        } else if (isCreationTransaction(transaction)) {
          return new TransactionItem(
            await this.creationTransactionMapper.mapTransaction(
              chainId,
              transaction as CreationTransaction,
              safe,
            ),
          );
        } else {
          // This should never happen as AJV would not allow an unknown transaction to get to this stage
          throw Error('Unrecognized transaction type');
        }
      }),
    );
  }
}
