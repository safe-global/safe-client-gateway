import { Inject, Injectable } from '@nestjs/common';
import { groupBy } from 'lodash';
import { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { EthereumTransaction } from '@/domain/safe/entities/ethereum-transaction.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import {
  isCreationTransaction,
  isEthereumTransaction,
  isModuleTransaction,
  isMultisigTransaction,
  Transaction as TransactionDomain,
} from '@/domain/safe/entities/transaction.entity';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import { DateLabel } from '@/routes/common/entities/date-label.entity';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';
import { CreationTransactionMapper } from '@/routes/transactions/mappers/creation-transaction/creation-transaction.mapper';
import { ModuleTransactionMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction.mapper';
import { IncomingTransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import { IConfigurationService } from '@/config/configuration.service.interface';

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
export class TransactionsHistoryMapper {
  private readonly maxNestedTransfers: number;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly incomingTransferMapper: IncomingTransferMapper,
    private readonly creationTransactionMapper: CreationTransactionMapper,
  ) {
    this.maxNestedTransfers = configurationService.getOrThrow(
      'mappings.history.maxNestedTransfers',
    );
  }

  async mapTransactionsHistory(
    chainId: string,
    transactionsDomain: TransactionDomain[],
    safe: Safe,
    offset: number,
    timezoneOffset: number,
  ): Promise<Array<TransactionItem | DateLabel>> {
    if (transactionsDomain.length == 0) {
      return [];
    }
    const previousTransaction = this.getPreviousItem(
      offset,
      transactionsDomain,
    );
    let prevPageTimestamp = 0;
    if (previousTransaction !== null) {
      prevPageTimestamp = this.getDayFromTransactionDate(
        previousTransaction,
        timezoneOffset,
      ).getTime();
      // Remove first transaction that was requested to get previous day timestamp
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
        const groupTransactions = (
          await this.mapGroupTransactions(transactionGroup, chainId, safe)
        )
          .filter(<T>(x: T | undefined): x is T => x != null)
          .flat();
        transactions.push(...groupTransactions);
        return transactions;
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

  private getPreviousItem(
    offset: number,
    transactions: TransactionDomain[],
  ): TransactionDomain | null {
    // More than 1 element is required to get the previous page date
    if (offset <= 0 || transactions.length <= 1) return null;
    return transactions[0];
  }

  private getDayFromTransactionDate(
    transaction: TransactionDomain,
    timezoneOffset: number,
  ): Date {
    const timestamp = this.getTransactionTimestamp(transaction);
    return this.getDayStartForDate(timestamp, timezoneOffset);
  }

  private groupByDay(
    transactions: TransactionDomain[],
    timezoneOffset: number,
  ): TransactionDomainGroup[] {
    return Object.entries(
      groupBy(transactions, (transaction) => {
        return this.getDayFromTransactionDate(
          transaction,
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
  /**
   * Returns a day {@link Date } at 00:00:00 from the input timestamp.
   *
   * @param timestamp - date to convert
   * @param timezoneOffset - Offset of time zone in milliseconds
   */
  private getDayStartForDate(timestamp: Date, timezoneOffset: number): Date {
    if (timezoneOffset != 0) {
      timestamp.setUTCMilliseconds(timezoneOffset);
    }
    return new Date(
      Date.UTC(
        timestamp.getUTCFullYear(),
        timestamp.getUTCMonth(),
        timestamp.getUTCDate(),
      ),
    );
  }

  private mapTransfer(transfers: Transfer[], chainId: string, safe: Safe) {
    return transfers
      .slice(0, this.maxNestedTransfers)
      .map(
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
    transactionGroup: TransactionDomainGroup,
    chainId: string,
    safe: Safe,
  ): Promise<(TransactionItem | TransactionItem[] | undefined)[]> {
    return Promise.all(
      transactionGroup.transactions.map(async (transaction) => {
        if (isMultisigTransaction(transaction)) {
          return new TransactionItem(
            await this.multisigTransactionMapper.mapTransaction(
              chainId,
              transaction,
              safe,
            ),
          );
        } else if (isModuleTransaction(transaction)) {
          return new TransactionItem(
            await this.moduleTransactionMapper.mapTransaction(
              chainId,
              transaction,
            ),
          );
        } else if (isEthereumTransaction(transaction)) {
          const transfers = transaction.transfers;
          if (transfers != null) {
            return await Promise.all(
              this.mapTransfer(transfers, chainId, safe),
            );
          }
        } else if (isCreationTransaction(transaction)) {
          return new TransactionItem(
            await this.creationTransactionMapper.mapTransaction(
              chainId,
              transaction,
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
