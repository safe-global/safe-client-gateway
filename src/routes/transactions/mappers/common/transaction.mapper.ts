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
import { TransactionDomainGroup } from '../../entities/transaction-history-group.entity';
import { DateLabel } from '../../entities/date-label.entity';

@Injectable()
export class TransactionMapper {
  constructor(
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly incomingTransferMapper: IncomingTransferMapper,
  ) {}
  async mapTransaction(
    chainId: string,
    transactionsDomain: TransactionDomain[],
    safe: Safe,
    timezoneOffset?: string,
    offset?: number,
  ) {
    const transactionList: any[] = [];

    let prev_page_timestamp = 0;
    if (offset !== undefined && offset > 0) {
      // Get previous page label
      const timestamp =
        transactionsDomain[0].executionDate?.getTime() ??
        (
          transactionsDomain[0] as MultisigTransaction
        ).submissionDate?.getTime();
      if (timestamp !== undefined) {
        prev_page_timestamp = this.getDayInMillis(timestamp, timezoneOffset);
      } else {
        throw Error('ExecutionDate cannot be null');
      }
      transactionsDomain = transactionsDomain.slice(1);
    }
    const transactionsDomainGroups = this.groupByDay(
      transactionsDomain,
      timezoneOffset,
    );
    transactionsDomainGroups.forEach((transactionGroup) => {
      if (transactionGroup.timestamp != prev_page_timestamp) {
        transactionList.push(new DateLabel(transactionGroup.timestamp));
      }
      transactionList.push(
        Promise.all(
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
              return transfers
                ? await Promise.all(
                    transfers.map(
                      async (transfer) =>
                        new TransactionItem(
                          await this.incomingTransferMapper.mapTransfer(
                            chainId,
                            transfer,
                            safe,
                          ),
                        ),
                    ),
                  )
                : null;
            } else {
              // This should never happen as AJV would not allow an unknown transaction to get to this stage
              throw Error('Unrecognized transaction type');
            }
          }),
        ),
      );
    });

    return (await Promise.all(transactionList)).flat(2);
  }

  private groupByDay(
    transactions: TransactionDomain[],
    timezoneOffset?: string,
  ): TransactionDomainGroup[] {
    return Object.entries(
      groupBy(transactions, (transaction) => {
        let transaction_timestamp;
        if (isMultisigTransaction(transaction)) {
          transaction_timestamp =
            transaction.executionDate ?? transaction.submissionDate;
        } else {
          transaction_timestamp = transaction.executionDate;
        }
        return this.getDayInMillis(
          transaction_timestamp?.getTime(),
          timezoneOffset,
        );
      }),
    ).map(
      ([timestamp, transactions]) =>
        <TransactionDomainGroup>{
          timestamp: Number(timestamp),
          transactions: transactions,
        },
    );
  }

  private getDayInMillis(timestamp: number, timezoneOffset?: string): number {
    const date = new Date(timestamp);
    if (timezoneOffset !== undefined) {
      date.setUTCSeconds(parseInt(timezoneOffset) || 0);
    }
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
