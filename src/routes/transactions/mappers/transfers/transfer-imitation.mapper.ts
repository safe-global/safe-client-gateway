import { IConfigurationService } from '@/config/configuration.service.interface';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';
import {
  isTransferTransactionInfo,
  TransferDirection,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { isErc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { Inject } from '@nestjs/common';

export class TransferImitationMapper {
  private readonly prefixLength: number;
  private readonly suffixLength: number;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
  ) {
    this.prefixLength = configurationService.getOrThrow(
      'mappings.imitation.prefixLength',
    );
    this.suffixLength = configurationService.getOrThrow(
      'mappings.imitation.suffixLength',
    );
  }

  mapImitations(args: {
    transactions: Array<TransactionItem>;
    previousTransaction: TransactionItem | undefined;
    showImitations: boolean;
  }): Array<TransactionItem> {
    const transactions = this.mapTransferInfoImitation(
      args.transactions,
      args.previousTransaction,
    );

    if (args.showImitations) {
      return transactions;
    }

    return transactions.filter(({ transaction }) => {
      const { txInfo } = transaction;
      return (
        !isTransferTransactionInfo(txInfo) ||
        !isErc20Transfer(txInfo.transferInfo) ||
        // null by default or explicitly false if not imitation
        txInfo.transferInfo?.imitation !== true
      );
    });
  }

  /**
   * Flags outgoing ERC20 transfers that imitate their direct predecessor in value
   * and have a recipient address that is not the same but matches in vanity.
   *
   * @param transactions - list of transactions to map
   * @param previousTransaction - transaction to compare last {@link transactions} against
   *
   * Note: this only handles singular imitation transfers. It does not handle multiple
   * imitation transfers in a row, nor does it compare batched multiSend transactions
   * as the "distance" between those batched and their imitation may not be immediate.
   */
  private mapTransferInfoImitation(
    transactions: Array<TransactionItem>,
    previousTransaction?: TransactionItem,
  ): Array<TransactionItem> {
    return transactions.map((item, i, arr) => {
      // Executed by Safe - cannot be imitation
      if (item.transaction.executionInfo) {
        return item;
      }

      // Transaction list is in date-descending order. We compare each transaction with the next
      // unless we are comparing the last transaction, in which case we compare it with the
      // "previous transaction" (the first transaction of the subsequent page).
      const prevItem = i === arr.length - 1 ? previousTransaction : arr[i + 1];

      // No reference transaction to filter against
      if (!prevItem) {
        return item;
      }

      if (
        // Only consider transfers...
        !isTransferTransactionInfo(item.transaction.txInfo) ||
        !isTransferTransactionInfo(prevItem.transaction.txInfo) ||
        // ...of ERC20s...
        !isErc20Transfer(item.transaction.txInfo.transferInfo) ||
        !isErc20Transfer(prevItem.transaction.txInfo.transferInfo)
      ) {
        return item;
      }

      // ...that are outgoing
      const isOutgoing =
        item.transaction.txInfo.direction === TransferDirection.Outgoing;
      const isPrevOutgoing =
        prevItem.transaction.txInfo.direction === TransferDirection.Outgoing;
      if (!isOutgoing || !isPrevOutgoing) {
        return item;
      }

      // Imitation transfers are of the same value...
      const isSameValue =
        item.transaction.txInfo.transferInfo.value ===
        prevItem.transaction.txInfo.transferInfo.value;
      if (!isSameValue) {
        return item;
      }

      item.transaction.txInfo.transferInfo.imitation = this.isImitatorAddress(
        item.transaction.txInfo.recipient.value,
        prevItem.transaction.txInfo.recipient.value,
      );

      return item;
    });
  }

  private isImitatorAddress(address1: string, address2: string): boolean {
    const a1 = address1.toLowerCase();
    const a2 = address2.toLowerCase();

    // Same address is not an imitation
    if (a1 === a2) {
      return false;
    }

    const isSamePrefix =
      // Ignore `0x` prefix
      a1.slice(2, 2 + this.prefixLength) === a2.slice(2, 2 + this.prefixLength);
    const isSameSuffix =
      a1.slice(-this.suffixLength) === a2.slice(-this.suffixLength);
    return isSamePrefix && isSameSuffix;
  }
}
