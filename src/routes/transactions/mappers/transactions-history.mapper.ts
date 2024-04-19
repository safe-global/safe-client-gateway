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
import {
  Transfer,
  isERC20Transfer,
} from '@/domain/safe/entities/transfer.entity';
import { DateLabel } from '@/routes/common/entities/date-label.entity';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';
import { CreationTransactionMapper } from '@/routes/transactions/mappers/creation-transaction/creation-transaction.mapper';
import { ModuleTransactionMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction.mapper';
import { TransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import { IConfigurationService } from '@/config/configuration.service.interface';

class TransactionDomainGroup {
  timestamp!: number;
  transactions!: (
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
      // Filter poisoned transactions
      transactionsDomain = this.getLegitimateTransactions(
        safe.address,
        transactionsDomain,
      );
      // Remove first transaction that was requested to get previous day timestamp
      transactionsDomain = transactionsDomain.slice(1);
    }

    const transactionsDomainGroups = this.groupByDay(
      transactionsDomain,
      timezoneOffset,
    );

    const transactionList = await Promise.all(
      transactionsDomainGroups.map(async (transactionGroup) => {
        const items: (TransactionItem | DateLabel)[] = [];
        const groupTransactions = (
          await this.mapGroupTransactions(
            transactionGroup,
            chainId,
            safe,
            onlyTrusted,
          )
        )
          .filter(<T>(x: T | undefined): x is T => x != null)
          .flat();

        // If the current group is a follow-up from the previous page,
        // or the group is empty, the date label shouldn't be added.
        const isFollowUp = transactionGroup.timestamp == prevPageTimestamp;
        if (!isFollowUp && groupTransactions.length) {
          items.push(new DateLabel(transactionGroup.timestamp));
        }
        items.push(...groupTransactions);
        return items;
      }),
    );

    return transactionList.flat();
  }

  private getLegitimateTransactions(
    safeAddress: string,
    transactions: TransactionDomainGroup['transactions'],
  ): TransactionDomainGroup['transactions'] {
    /**
     * The following filters poisoned events that are:
     * - immediately after legitimate transfers
     * - outgoing transfers
     * - of the same value
     * - by 4-char. vanity addresses
     *
     * It does not:
     * - support referencing transfers within multiSends
     * - have dynamic heuristics
     * - depend on the trusted flag or have a feature flag
     */

    return transactions.map((item, i, arr) => {
      // Address poisoning only targets transfers
      if (!isEthereumTransaction(item) || !item.transfers) {
        return item;
      }

      // Get the previous transaction...
      const prevItem = arr[i - 1];
      if (
        !prevItem ||
        !isEthereumTransaction(prevItem) ||
        !prevItem.transfers
      ) {
        return item;
      }

      // ...get the last transfer
      const prevTransfers = prevItem.transfers
        .filter(isERC20Transfer)
        .filter((prev) => safeAddress === prev.from);
      const prevTransfer = prevTransfers.at(-1);

      if (!prevTransfer) {
        return item;
      }

      const legitTransfers = item.transfers.filter((transfer) => {
        // Non-ERC20 transfers are always considered legitimate
        if (!isERC20Transfer(transfer)) return true;

        const isOutgoing = safeAddress === transfer.from;
        if (isOutgoing) return true;

        const isSameValue = transfer.value === prevTransfer.value;
        if (!isSameValue) return true;

        const sender = transfer.from.toLowerCase();
        const prevSender = prevTransfer.from.toLowerCase();

        const isSameAddress = sender === prevSender;
        return !isSameAddress && !this.isVanityAddress(sender, prevSender);
      });

      item.transfers = legitTransfers.length === 0 ? null : legitTransfers;

      return item;
    });
  }

  private isVanityAddress(address1: string, address2: string): boolean {
    const VANITY_THRESHOLD = 4;
    return (
      // Ignore `0x` prefix
      address1.slice(2, VANITY_THRESHOLD) ===
        address2.slice(2, VANITY_THRESHOLD) ||
      address1.slice(-VANITY_THRESHOLD) === address2.slice(-VANITY_THRESHOLD)
    );
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
    ).map(([, transactions]): TransactionDomainGroup => {
      // The groups respect the timezone offset – this was done for grouping only.
      // The actual value of the group should be in the UTC timezone instead
      // A group should always have at least one transaction.
      return {
        timestamp: this.getTransactionTimestamp(transactions[0]).getTime(),
        transactions: transactions,
      };
    });
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

  private mapGroupTransactions(
    transactionGroup: TransactionDomainGroup,
    chainId: string,
    safe: Safe,
    onlyTrusted: boolean,
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
            return await this.mapTransfers(
              transfers,
              chainId,
              safe,
              onlyTrusted,
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
