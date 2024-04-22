import { Inject, Injectable } from '@nestjs/common';
import { groupBy } from 'lodash';
import {
  TransferDirection,
  isTransferTransactionInfo,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { isErc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
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

@Injectable()
export class TransactionsHistoryMapper {
  private readonly VANITY_ADDRESS_CHARS = 4;

  private readonly maxNestedTransfers: number;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly transferMapper: TransferMapper,
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
    onlyTrusted: boolean,
  ): Promise<Array<TransactionItem | DateLabel>> {
    if (transactionsDomain.length == 0) {
      return [];
    }
    const previousTransaction = await (async (): Promise<
      TransactionItem | undefined
    > => {
      const prevDomainTransaction = this.getPreviousItem(
        offset,
        transactionsDomain,
      );
      if (!prevDomainTransaction) {
        return;
      }
      // We map in order to filter last list item against it
      const mappedPreviousTransaction = await this.mapTransaction(
        prevDomainTransaction,
        chainId,
        safe,
        onlyTrusted,
      );
      // Remove first transaction that was requested to get previous day timestamp
      transactionsDomain = transactionsDomain.slice(1);

      return Array.isArray(mappedPreviousTransaction)
        ? mappedPreviousTransaction.at(-1)
        : mappedPreviousTransaction;
    })();

    const transactions = await (async (): Promise<Array<TransactionItem>> => {
      const mappedTransactions = await Promise.all(
        transactionsDomain.map((transaction) => {
          return this.mapTransaction(transaction, chainId, safe, onlyTrusted);
        }),
      );
      const transactionItems = mappedTransactions
        .filter(<T>(x: T): x is NonNullable<T> => x != null)
        .flat();

      // TODO: Decide on whether to filter or mark transactions as untrusted
      //       as well as hiding behind a feature flag.
      return this.filterTransactions(transactionItems, previousTransaction);
    })();

    // The groups respect timezone offset – this was done for grouping only.
    const transactionsByDay = this.groupByDay(transactions, timezoneOffset);
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

  /**
   * Filters out outgoing ERC20 transactions that match their direct predecessor
   * in terms of value and recipient address vanity - but not the exact address.
   *
   * @param transactions - list of transactions to filter
   * @param previousTransaction - transaction to compare last {@link transactions}
   *                              item against
   *
   * Note: this does not compare batched multiSend transactions as the "distance"
   * between those batched and their imitation would not be immediate.
   */
  private filterTransactions(
    transactions: TransactionItem[],
    previousTransaction: TransactionItem | undefined,
  ): Array<TransactionItem> {
    return transactions.filter((item, i, arr) => {
      // Executed by Safe - cannot be imitation
      if (item.transaction.executionInfo) {
        return true;
      }

      const prevItem = i === arr.length - 1 ? previousTransaction : arr[i + 1];
      // No reference transaction to filter against
      if (!prevItem) {
        return true;
      }

      const txInfo = item.transaction.txInfo;
      const prevTxInfo = prevItem.transaction.txInfo;

      // Only consider transfers...
      if (
        !isTransferTransactionInfo(txInfo) ||
        !isTransferTransactionInfo(prevTxInfo)
      ) {
        return true;
      }

      // ...of ERC20s...
      if (
        !isErc20Transfer(txInfo.transferInfo) ||
        !isErc20Transfer(prevTxInfo.transferInfo)
      ) {
        return true;
      }

      // ...that are outgoing
      const isOutgoing = txInfo.direction === TransferDirection.Outgoing;
      const isPrevOutgoing =
        prevTxInfo.direction === TransferDirection.Outgoing;
      if (!isOutgoing || !isPrevOutgoing) {
        return true;
      }

      // Imitation transfers are of the same value
      const isSameValue =
        txInfo.transferInfo.value === prevTxInfo.transferInfo.value;
      if (!isSameValue) {
        return true;
      }

      // If a recipient is a vanity address, but not the exact recipient
      // of the previous transaction, it is likely imitating it
      const isSameRecipient =
        txInfo.recipient.value === prevTxInfo.recipient.value;
      if (isSameRecipient) {
        return true;
      }
      return !this.isVanityAddress(
        txInfo.recipient.value,
        prevTxInfo.recipient.value,
        this.VANITY_ADDRESS_CHARS,
      );
    });
  }

  private isVanityAddress(
    address1: string,
    address2: string,
    chars: number,
  ): boolean {
    const a1 = address1.toLowerCase();
    const a2 = address2.toLowerCase();

    // Ignore `0x` prefix
    const isVanityPrefix = a1.slice(2, chars) === a2.slice(2, chars);
    const isVanitySuffix = a1.slice(-chars) === a2.slice(-chars);
    return isVanityPrefix && isVanitySuffix;
  }

  private getPreviousItem(
    offset: number,
    transactions: TransactionDomain[],
  ): TransactionDomain | null {
    // More than 1 element is required to get the previous page date
    if (offset <= 0 || transactions.length <= 1) return null;
    return transactions[0];
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
      // This should never happen as AJV would not allow an unknown transaction to get to this stage
      throw Error('Unrecognized transaction type');
    }
  }
}
