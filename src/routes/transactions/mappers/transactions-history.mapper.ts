import { Inject, Injectable } from '@nestjs/common';
import { groupBy } from 'lodash';
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
import { TransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ImitationTransactionsHelper } from '@/routes/transactions/helpers/imitation-transactions.helper';

@Injectable()
export class TransactionsHistoryMapper {
  private readonly isImitationFilteringEnabled: boolean;
  private readonly maxNestedTransfers: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly transferMapper: TransferMapper,
    private readonly creationTransactionMapper: CreationTransactionMapper,
    private readonly imitationTransactionsHelper: ImitationTransactionsHelper,
  ) {
    this.isImitationFilteringEnabled = this.configurationService.getOrThrow(
      'features.imitationFiltering',
    );
    this.maxNestedTransfers = this.configurationService.getOrThrow(
      'mappings.history.maxNestedTransfers',
    );
  }

  async mapTransactionsHistory(
    chainId: string,
    transactionsDomain: TransactionDomain[],
    safe: Safe,
    offset: number,
    timezoneOffset: number,
    onlyTrusted: boolean,
  ): Promise<Array<TransactionItem | DateLabel>> {
    if (transactionsDomain.length == 0) {
      return [];
    }
    // Must be retrieved before mapping others as we remove it from transactionsDomain
    const previousTransaction = await this.getPreviousTransaction({
      offset,
      transactionsDomain,
      chainId,
      safe,
      onlyTrusted,
    });

    const mappedTransactions = await this.getMappedTransactions({
      transactionsDomain,
      chainId,
      safe,
      previousTransaction,
      onlyTrusted,
    });

    // The groups respect timezone offset – this was done for grouping only.
    const transactionsByDay = this.groupByDay(
      mappedTransactions,
      timezoneOffset,
    );
    return transactionsByDay.reduce<Array<TransactionItem | DateLabel>>(
      (transactionList, transactionsOnDay) => {
        // The actual value of the group should be in the UTC timezone instead
        // A group should always have at least one transaction.
        const { timestamp } = transactionsOnDay[0].transaction;

        // If the current group is a follow-up from the previous page,
        // or the group is empty, the date label shouldn't be added.
        const isFollowUp =
          timestamp == previousTransaction?.transaction.timestamp;
        if (!isFollowUp && transactionsOnDay.length > 0 && timestamp) {
          transactionList.push(new DateLabel(timestamp));
        }
        return transactionList.concat(transactionsOnDay);
      },
      [],
    );
  }

  private async getPreviousTransaction(args: {
    offset: number;
    transactionsDomain: TransactionDomain[];
    chainId: string;
    safe: Safe;
    onlyTrusted: boolean;
  }): Promise<TransactionItem | undefined> {
    // More than 1 element is required to get the previous transaction
    if (args.offset <= 0 || args.transactionsDomain.length <= 1) {
      return;
    }
    const prevDomainTransaction = args.transactionsDomain[0];
    // We map in order to filter last list item against it
    const mappedPreviousTransaction = await this.mapTransaction(
      prevDomainTransaction,
      args.chainId,
      args.safe,
      args.onlyTrusted,
    );
    // Remove first transaction that was requested to get previous day timestamp
    args.transactionsDomain = args.transactionsDomain.slice(1);

    return Array.isArray(mappedPreviousTransaction)
      ? // All transfers should have same execution date but the last is "true" previous
        mappedPreviousTransaction.at(-1)
      : mappedPreviousTransaction;
  }

  private async getMappedTransactions(args: {
    transactionsDomain: TransactionDomain[];
    chainId: string;
    safe: Safe;
    previousTransaction: TransactionItem | undefined;
    onlyTrusted: boolean;
  }): Promise<TransactionItem[]> {
    const mappedTransactions = await Promise.all(
      args.transactionsDomain.map((transaction) => {
        return this.mapTransaction(
          transaction,
          args.chainId,
          args.safe,
          args.onlyTrusted,
        );
      }),
    );
    const transactionItems = mappedTransactions
      .filter(<T>(x: T): x is NonNullable<T> => x != null)
      .flat();

    if (!this.isImitationFilteringEnabled || !args.onlyTrusted) {
      return transactionItems;
    }

    return this.imitationTransactionsHelper.filterOutgoingErc20ImitationTransfers(
      transactionItems,
      args.previousTransaction,
    );
  }

  private groupByDay(
    transactions: TransactionItem[],
    timezoneOffset: number,
  ): TransactionItem[][] {
    const grouped = groupBy(transactions, ({ transaction }) => {
      // timestamp will always be defined for historical transactions
      const date = new Date(transaction.timestamp ?? 0);
      return this.getDayStartForDate(date, timezoneOffset).getTime();
    });
    return Object.values(grouped);
  }

  /**
   * Returns a day {@link Date } at 00:00:00 from the input timestamp.
   *
   * @param timestamp - date to convert
   * @param timezoneOffset - Offset of time zone in milliseconds
   */
  private getDayStartForDate(timestamp: Date, timezoneOffset: number): Date {
    const date = structuredClone(timestamp);
    date.setTime(date.getTime() + timezoneOffset);
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private async mapTransfers(
    transfers: Transfer[],
    chainId: string,
    safe: Safe,
    onlyTrusted: boolean,
  ): Promise<TransactionItem[]> {
    const limitedTransfers = transfers.slice(0, this.maxNestedTransfers);

    const nestedTransactions = await this.transferMapper.mapTransfers({
      chainId,
      transfers: limitedTransfers,
      safe,
      onlyTrusted,
    });

    return nestedTransactions.map(
      (nestedTransaction) => new TransactionItem(nestedTransaction),
    );
  }

  private async mapTransaction(
    transaction: TransactionDomain,
    chainId: string,
    safe: Safe,
    onlyTrusted: boolean,
  ): Promise<TransactionItem | TransactionItem[] | undefined> {
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
        await this.moduleTransactionMapper.mapTransaction(chainId, transaction),
      );
    } else if (isEthereumTransaction(transaction)) {
      const transfers = transaction.transfers;
      if (transfers != null) {
        return await this.mapTransfers(transfers, chainId, safe, onlyTrusted);
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
      // This should never happen as Zod would not allow an unknown transaction to get to this stage
      throw Error('Unrecognized transaction type');
    }
  }
}
