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
   * value and vanity (but not the exact) address of the recipient.
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
        return item;
      }

      const prevItem = i === arr.length - 1 ? previousTransaction : arr[i + 1];

      // No reference transaction to filter against
      if (!prevItem) {
        return item;
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
        return item;
      }

      // ...that are outgoing
      const isOutgoing = txInfo.direction === TransferDirection.Outgoing;
      const isPrevOutgoing =
        prevTxInfo.direction === TransferDirection.Outgoing;
      if (!isOutgoing || !isPrevOutgoing) {
        return item;
      }

      // Imitation transfers are of the same value...
      const isSameValue =
        txInfo.transferInfo.value === prevTxInfo.transferInfo.value;
      if (!isSameValue) {
        return item;
      }

      // ...from vanity (but not exact) recipient address
      const isSameRecipient =
        txInfo.recipient.value === prevTxInfo.recipient.value;
      if (isSameRecipient) {
        return item;
      }
      return !this.isVanityAddress(
        txInfo.recipient.value,
        prevTxInfo.recipient.value,
      );
    });
  }

  private isVanityAddress(address1: string, address2: string): boolean {
    const a1 = address1.toLowerCase();
    const a2 = address2.toLowerCase();

    const isVanityPrefix =
      // Ignore `0x` prefix
      a1.slice(2, this.vanityAddressChars) ===
      a2.slice(2, this.vanityAddressChars);
    const isVanitySuffix =
      a1.slice(-this.vanityAddressChars) === a2.slice(-this.vanityAddressChars);
    return isVanityPrefix && isVanitySuffix;
  }
}
