import { Injectable } from '@nestjs/common';
import {
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

class TransactionDomainGroup {
  timestamp: number;
  transactions:
    | MultisigTransaction[]
    | ModuleTransaction[]
    | EthereumTransaction[];
}

@Injectable()
export class TransactionsMapper {
  constructor(
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly incomingTransferMapper: IncomingTransferMapper,
  ) {}
  async mapTransactions(
    chainId: string,
    transactionsDomain: TransactionDomain[],
    safe: Safe,
    offset: number,
    timezoneOffset?: string,
  ): Promise<[TransactionItem | DateLabel]> {
    const prevPageTimestamp = this.getPreviousDayTimestamp(
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
        return await Promise.all(transactions.flat());
      }),
    );

    return <[TransactionItem | DateLabel]>transactionList.flat();
  }

  private getPreviousDayTimestamp(
    transactions: TransactionDomain[],
    offset: number,
    timezoneOffset?: string,
  ): Date | undefined {
    if (offset > 0) {
      // Get previous page label
      const timestamp =
        transactions[0].executionDate ??
        (transactions[0] as MultisigTransaction).submissionDate;
      if (timestamp !== null) {
        return this.getDayDate(timestamp, timezoneOffset);
      } else {
        throw Error('ExecutionDate cannot be null');
      }
    }
  }

  private groupByDay(
    transactions: TransactionDomain[],
    timezoneOffset?: string,
  ): TransactionDomainGroup[] {
    return Object.entries(
      groupBy(transactions, (transaction) => {
        let transactionTimestamp;
        if (isMultisigTransaction(transaction)) {
          transactionTimestamp =
            transaction.executionDate ?? transaction.submissionDate;
        } else {
          transactionTimestamp = transaction.executionDate;
        }
        return this.getDayDate(transactionTimestamp, timezoneOffset).getTime();
      }),
    ).map(
      ([timestamp, transactions]) =>
        <TransactionDomainGroup>{
          timestamp: Number(timestamp),
          transactions: transactions,
        },
    );
  }

  private getDayDate(timestamp: Date, timezoneOffset?: string): Date {
    if (timezoneOffset !== undefined) {
      timestamp.setUTCSeconds(parseInt(timezoneOffset) || 0);
    }
    return new Date(
      Date.UTC(
        timestamp.getFullYear(),
        timestamp.getMonth(),
        timestamp.getDate(),
      ),
    );
  }

  private mapEthereumTransfer(
    transfers: Transfer[],
    chainId: string,
    safe: Safe,
  ) {
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
    const transactions: TransactionItem[] = transactionGroup.transactions.map(
      async (transaction) => {
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
              this.mapEthereumTransfer(transfers, chainId, safe),
            );
          }
        } else {
          // This should never happen as AJV would not allow an unknown transaction to get to this stage
          throw Error('Unrecognized transaction type');
        }
      },
    );
    return Promise.all(transactions);
  }
}
