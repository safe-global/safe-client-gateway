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
import { TransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { isTransferTransactionInfo } from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { isErc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';

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
  private readonly isTrustedTokensEnabled: boolean;

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
    this.isTrustedTokensEnabled = configurationService.getOrThrow(
      'features.trustedTokens',
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
          await this.mapGroupTransactions(
            transactionGroup,
            chainId,
            safe,
            onlyTrusted,
          )
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

  private async mapTransfers(
    transfers: Transfer[],
    chainId: string,
    safe: Safe,
    onlyTrusted: boolean,
  ): Promise<TransactionItem[]> {
    const limitedTransfers = transfers.slice(0, this.maxNestedTransfers);
    const result: TransactionItem[] = [];

    for (const transfer of limitedTransfers) {
      const nestedTransaction = await this.transferMapper.mapTransfer(
        chainId,
        transfer,
        safe,
      );

      const transferWithValue = this.mapZeroValueTransfer(nestedTransaction);
      // If we do not have a transfer with value, we do not add it to the result
      if (!transferWithValue) continue;

      // TODO remove isTrustedTokensEnabled when feature is considered stable
      const trustedTransfer =
        this.isTrustedTokensEnabled && onlyTrusted
          ? this.mapTrustedTransfer(transferWithValue)
          : transferWithValue;

      if (!trustedTransfer) continue;
      result.push(new TransactionItem(nestedTransaction));
    }
    return result;
  }

  /**
   * Returns the transaction if it is an ERC20 transfer with value.
   * Returns Null otherwise.
   *
   * @private
   */
  private mapZeroValueTransfer(transaction: Transaction): Transaction | null {
    if (!isTransferTransactionInfo(transaction.txInfo)) return transaction;
    if (!isErc20Transfer(transaction.txInfo.transferInfo)) return transaction;

    if (transaction.txInfo.transferInfo.value === '0') return null;
    return transaction;
  }

  private mapTrustedTransfer(transaction: Transaction): Transaction | null {
    if (!isTransferTransactionInfo(transaction.txInfo)) return transaction;
    if (!isErc20Transfer(transaction.txInfo.transferInfo)) return transaction;

    // If we have successfully retrieved the token information, and it is a
    // trusted token, return it. Else return null
    if (transaction.txInfo.transferInfo.trusted) {
      return transaction;
    } else {
      return null;
    }
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
