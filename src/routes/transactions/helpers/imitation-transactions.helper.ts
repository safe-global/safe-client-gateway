import { IConfigurationService } from '@/config/configuration.service.interface';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';
import {
  isTransferTransactionInfo,
  TransferDirection,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { isErc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { Inject } from '@nestjs/common';

export class ImitationTransactionsHelper {
  private readonly vanityAddressChars: number;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
  ) {
    this.vanityAddressChars = configurationService.getOrThrow(
      'mappings.imitationTransactions.vanityAddressChars',
    );
  }

  /**
   * Filters out outgoing ERC20 transfers that imitate their direct predecessor in
   * value and have a recipient address that is not the same but matches in vanity.
   *
   * @param transactions - list of transactions to filter
   * @param previousTransaction - transaction to compare last {@link transactions} against
   *
   * Note: this only handles singular imitation transfers. It does not handle multiple
   * imitation transfers in a row, nor does it compare batched multiSend transactions
   * as the "distance" between those batched and their imitation may not be immediate.
   */
  filterOutgoingErc20ImitationTransfers(
    transactions: Array<TransactionItem>,
    previousTransaction: TransactionItem | undefined,
  ): Array<TransactionItem> {
    // TODO: Instead of filtering, mark transactions so client can display them differently
    return transactions.filter((item, i, arr) => {
      // Executed by Safe - cannot be imitation
      if (item.transaction.executionInfo) {
        return true;
      }

      // Transaction list is in date-descending order. We compare each transaction with the next
      // unless we are comparing the last transaction, in which case we compare it with the
      // "previous transaction" (the first transaction of the subsequent page).
      const prevItem = i === arr.length - 1 ? previousTransaction : arr[i + 1];

      // No reference transaction to filter against
      if (!prevItem) {
        return true;
      }

      const txInfo = item.transaction.txInfo;
      const prevTxInfo = prevItem.transaction.txInfo;

      if (
        // Only consider transfers...
        !isTransferTransactionInfo(txInfo) ||
        !isTransferTransactionInfo(prevTxInfo) ||
        // ...of ERC20s...
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

      // Imitation transfers are of the same value...
      const isSameValue =
        txInfo.transferInfo.value === prevTxInfo.transferInfo.value;
      if (!isSameValue) {
        return true;
      }

      // ...from recipient that has the same vanity but is not the same address
      return !this.isImitatorAddress(
        txInfo.recipient.value,
        prevTxInfo.recipient.value,
      );
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
      a1.slice(2, 2 + this.vanityAddressChars) ===
      a2.slice(2, 2 + this.vanityAddressChars);
    const isSameSuffix =
      a1.slice(-this.vanityAddressChars) === a2.slice(-this.vanityAddressChars);
    return isSamePrefix && isSameSuffix;
  }
}
