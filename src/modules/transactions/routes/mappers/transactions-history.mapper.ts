// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import groupBy from 'lodash/groupBy';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { IDataDecoderRepository } from '#/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import type { DataDecoded } from '#/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import {
  isCreationTransaction,
  isEthereumTransaction,
  isModuleTransaction,
  isMultisigTransaction,
  type Transaction as TransactionDomain,
} from '#/modules/safe/domain/entities/transaction.entity';
import type { Transfer } from '#/modules/safe/domain/entities/transfer.entity';
import type { DecodedTransaction } from '#/modules/transactions/domain/entities/decoded-transaction.entity';
import { TransactionItem } from '#/modules/transactions/routes/entities/transaction-item.entity';
import {
  calculateTimezoneOffset,
  convertToTimezone,
} from '#/modules/transactions/routes/helpers/timezone.helper';
import { CreationTransactionMapper } from '#/modules/transactions/routes/mappers/creation-transaction/creation-transaction.mapper';
import { ModuleTransactionMapper } from '#/modules/transactions/routes/mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import { TransferMapper } from '#/modules/transactions/routes/mappers/transfers/transfer.mapper';
import { TransferImitationMapper } from '#/modules/transactions/routes/mappers/transfers/transfer-imitation.mapper';
import { AddressInfoHelper } from '#/routes/common/address-info/address-info.helper';
import type { AddressLookups } from '#/routes/common/address-info/address-lookups';
import { DateLabel } from '#/routes/common/entities/date-label.entity';

@Injectable()
export class TransactionsHistoryMapper {
  private readonly maxNestedTransfers: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IDataDecoderRepository)
    private readonly dataDecoderRepository: IDataDecoderRepository,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly transferMapper: TransferMapper,
    private readonly transferImitationMapper: TransferImitationMapper,
    private readonly creationTransactionMapper: CreationTransactionMapper,
    private readonly addressInfoHelper: AddressInfoHelper,
  ) {
    this.maxNestedTransfers = this.configurationService.getOrThrow(
      'mappings.history.maxNestedTransfers',
    );
  }

  async mapTransactionsHistory(
    chainId: string,
    transactionsDomain: Array<TransactionDomain>,
    safe: Safe,
    offset: number,
    timezoneOffset: number,
    onlyTrusted: boolean,
    showImitations: boolean,
    timezone?: string,
  ): Promise<Array<TransactionItem | DateLabel>> {
    if (transactionsDomain.length === 0) {
      return [];
    }

    const decodedTransactions = await Promise.all(
      transactionsDomain.map(async (transaction) => ({
        transaction,
        dataDecoded: await this.dataDecoderRepository.getTransactionDataDecoded(
          { chainId, transaction },
        ),
      })),
    );

    const addressLookups = this.addressInfoHelper.createLookups(chainId);

    let previousTransaction: TransactionItem | undefined;
    let transactions = decodedTransactions;

    /**
     * We insert a {@link DateLabel} between transactions on different days.
     * On subsequent pages (offset > 0), we fetch the last transaction of previous page
     * to determine if the first transaction of the current page is on the same day.
     */
    if (offset > 0 && transactionsDomain.length > 1) {
      previousTransaction = await this.getPreviousTransaction({
        transactions: decodedTransactions,
        chainId,
        safe,
        onlyTrusted,
        addressLookups,
      });

      // Remove first transaction that was requested to get previous day timestamp
      transactions = decodedTransactions.slice(1);
    }

    const mappedTransactions = await this.getMappedTransactions({
      transactions,
      chainId,
      safe,
      previousTransaction,
      onlyTrusted,
      showImitations,
      addressLookups,
    });

    // The groups respect timezone offset – this was done for grouping only.
    const transactionsByDay = this.groupByDay(
      mappedTransactions,
      timezoneOffset,
      timezone,
    );
    return transactionsByDay.reduce<Array<TransactionItem | DateLabel>>(
      (transactionList, transactionsOnDay) => {
        // The actual value of the group should be in the UTC timezone instead
        // A group should always have at least one transaction.
        const { timestamp } = transactionsOnDay[0].transaction;

        // If the current group is a follow-up from the previous page,
        // or the group is empty, the date label shouldn't be added.
        const isFollowUp =
          timestamp === previousTransaction?.transaction.timestamp;
        if (!isFollowUp && transactionsOnDay.length > 0 && timestamp) {
          transactionList.push(new DateLabel(timestamp));
        }
        return transactionList.concat(transactionsOnDay);
      },
      [],
    );
  }

  private async getPreviousTransaction(args: {
    transactions: Array<DecodedTransaction>;
    chainId: string;
    safe: Safe;
    onlyTrusted: boolean;
    addressLookups: AddressLookups;
  }): Promise<TransactionItem | undefined> {
    const { transaction, dataDecoded } = args.transactions[0];

    // We map in order to filter last list item against it
    const mappedPreviousTransaction = await this.mapTransaction(
      transaction,
      args.chainId,
      args.safe,
      args.onlyTrusted,
      dataDecoded,
      args.addressLookups,
    );

    return Array.isArray(mappedPreviousTransaction)
      ? // All transfers should have same execution date but the last is "true" previous
        mappedPreviousTransaction.at(-1)
      : mappedPreviousTransaction;
  }

  private async getMappedTransactions(args: {
    transactions: Array<DecodedTransaction>;
    chainId: string;
    safe: Safe;
    previousTransaction: TransactionItem | undefined;
    onlyTrusted: boolean;
    showImitations: boolean;
    addressLookups: AddressLookups;
  }): Promise<Array<TransactionItem>> {
    const mappedTransactions = await Promise.all(
      args.transactions.map(({ transaction, dataDecoded }) => {
        return this.mapTransaction(
          transaction,
          args.chainId,
          args.safe,
          args.onlyTrusted,
          dataDecoded,
          args.addressLookups,
        );
      }),
    );
    const transactionItems = mappedTransactions
      .filter(<T>(x: T): x is NonNullable<T> => x != null)
      .flat();

    return this.transferImitationMapper.mapImitations({
      transactions: transactionItems,
      previousTransaction: args.previousTransaction,
      showImitations: args.showImitations,
    });
  }

  private groupByDay(
    transactions: Array<TransactionItem>,
    timezoneOffset: number,
    timezone?: string,
  ): Array<Array<TransactionItem>> {
    const grouped = groupBy(transactions, ({ transaction }) => {
      // timestamp will always be defined for historical transactions
      const date = new Date(transaction.timestamp ?? 0);
      return this.getDayStartForDate(date, timezoneOffset, timezone).getTime();
    });
    return Object.values(grouped);
  }

  /**
   * Returns a day {@link Date } at 00:00:00 from the input timestamp.
   *
   * @param timestamp - date to convert
   * @param timezoneOffset - Offset of time zone in milliseconds
   * @param {string} timezone - If timezone id is passed, timezoneOffset will be ignored
   */
  private getDayStartForDate(
    timestamp: Date,
    timezoneOffset: number,
    timezone?: string,
  ): Date {
    return timezone
      ? convertToTimezone(timestamp, timezone)
      : calculateTimezoneOffset(timestamp, timezoneOffset);
  }

  private async mapTransfers(
    transfers: Array<Transfer>,
    chainId: string,
    safe: Safe,
    onlyTrusted: boolean,
    addressLookups: AddressLookups,
  ): Promise<Array<TransactionItem>> {
    const limitedTransfers = transfers.slice(0, this.maxNestedTransfers);

    const nestedTransactions = await this.transferMapper.mapTransfers({
      chainId,
      transfers: limitedTransfers,
      safe,
      onlyTrusted,
      addressLookups,
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
    dataDecoded: DataDecoded | null,
    addressLookups: AddressLookups,
  ): Promise<TransactionItem | Array<TransactionItem> | undefined> {
    if (isMultisigTransaction(transaction)) {
      return new TransactionItem(
        await this.multisigTransactionMapper.mapTransaction(
          chainId,
          transaction,
          safe,
          dataDecoded,
          addressLookups,
        ),
      );
    }
    if (isModuleTransaction(transaction)) {
      return new TransactionItem(
        await this.moduleTransactionMapper.mapTransaction(
          chainId,
          transaction,
          dataDecoded,
          addressLookups,
        ),
      );
    }
    if (isEthereumTransaction(transaction)) {
      const transfers = transaction.transfers;
      if (transfers != null) {
        return await this.mapTransfers(
          transfers,
          chainId,
          safe,
          onlyTrusted,
          addressLookups,
        );
      }
    } else if (isCreationTransaction(transaction)) {
      return new TransactionItem(
        await this.creationTransactionMapper.mapTransaction(
          addressLookups,
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
