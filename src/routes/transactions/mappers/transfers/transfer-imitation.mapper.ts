import { IConfigurationService } from '@/config/configuration.service.interface';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';
import {
  isTransferTransactionInfo,
  TransferDirection,
  TransferTransactionInfo,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { isErc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { Inject } from '@nestjs/common';
import { formatUnits } from 'viem';

export class TransferImitationMapper {
  private static ETH_DECIMALS = 18;

  private readonly lookupDistance: number;
  private readonly prefixLength: number;
  private readonly suffixLength: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.lookupDistance = configurationService.getOrThrow(
      'mappings.imitation.lookupDistance',
    );
    this.prefixLength = configurationService.getOrThrow(
      'mappings.imitation.prefixLength',
    );
    this.suffixLength = configurationService.getOrThrow(
      'mappings.imitation.suffixLength',
    );
  }

  /**
   * Flags or filters (according to {@link args.showImitations}) transactions
   * that are likely imitations, based on the value and vanity of the address of
   * the sender or recipient.
   *
   * Note: does not support batched transactions as we have no transaction data
   * to decode the individual transactions from.
   *
   * @param args.transactions - transactions to map
   * @param args.previousTransaction - first transaction of the next page
   * @param args.showImitations - whether to filter out imitations
   *
   * @returns - mapped transactions
   */
  mapImitations(args: {
    transactions: Array<TransactionItem>;
    previousTransaction: TransactionItem | undefined;
    showImitations: boolean;
  }): Array<TransactionItem> {
    const mappedTransactions: Array<TransactionItem> = [];

    // Iterate in reverse order as transactions are date descending
    for (let i = args.transactions.length - 1; i >= 0; i--) {
      const item = args.transactions[i];

      // Executed by Safe - cannot be imitation
      if (item.transaction.executionInfo) {
        mappedTransactions.unshift(item);
        continue;
      }

      const txInfo = item.transaction.txInfo;
      // Only transfers can be imitated, of which we are only interested in ERC20s
      if (
        !isTransferTransactionInfo(txInfo) ||
        !isErc20Transfer(txInfo.transferInfo)
      ) {
        mappedTransactions.unshift(item);
        continue;
      }

      /**
       * Transactions to compare for imitation against, limited by a lookup distance.
       *
       * Concatenation takes preference of already mapped transactions over their
       * original in order to prevent comparison against duplicates.
       * Its length is {@link transactions} + 1 as {@link previousTransaction}
       * is appended to compare {@link transactions.at(-1)} against.
       */
      const prevItems = mappedTransactions
        .concat(args.transactions.slice(i - 1), args.previousTransaction ?? [])
        // Only compare so far back
        .slice(0, this.lookupDistance);

      if (prevItems.length === 0) {
        mappedTransactions.unshift(item);
        continue;
      }

      // Imitation transfers often employ differing decimals to prevent direct
      // comparison of values. Here we normalize the value
      const formattedValue = this.formatValue(
        txInfo.transferInfo.value,
        txInfo.transferInfo.decimals,
      );
      // Either sender or recipient according to "direction" of transaction
      const refAddress = this.getReferenceAddress(txInfo);

      const isImitation = prevItems.some((prevItem) => {
        const prevTxInfo = prevItem.transaction.txInfo;
        if (
          !isTransferTransactionInfo(prevTxInfo) ||
          !isErc20Transfer(prevTxInfo.transferInfo) ||
          // Do not compare against previously identified imitations
          prevTxInfo.transferInfo.imitation
        ) {
          return false;
        }

        const prevFormattedValue = this.formatValue(
          prevTxInfo.transferInfo.value,
          prevTxInfo.transferInfo.decimals,
        );

        // Imitation transfers match in value
        if (formattedValue !== prevFormattedValue) {
          return false;
        }

        // Imitation transfers match in vanity of address
        const prevRefAddress = this.getReferenceAddress(prevTxInfo);
        return this.isImitatorAddress(refAddress, prevRefAddress);
      });

      txInfo.transferInfo.imitation = isImitation;

      if (!isImitation || args.showImitations) {
        mappedTransactions.unshift(item);
      }
    }

    return mappedTransactions;
  }

  /**
   * Returns a string value of the value multiplied by the given decimals
   * @param value - value to format
   * @param decimals - decimals to multiply value by
   * @returns - formatted value
   */
  private formatValue(value: string, decimals: number | null): string {
    // Default to "standard" Ethereum decimals
    const _decimals = decimals ?? TransferImitationMapper.ETH_DECIMALS;
    return formatUnits(BigInt(value), _decimals);
  }

  /**
   * Returns the address of the sender or recipient according to the direction
   * @param txInfo - transaction info
   * @returns - address of sender or recipient
   */
  private getReferenceAddress(txInfo: TransferTransactionInfo) {
    return txInfo.direction === TransferDirection.Outgoing
      ? txInfo.recipient.value
      : txInfo.sender.value;
  }

  /**
   * Returns whether the two addresses match in vanity
   * @param address1 - address to compare against
   * @param address2  - second address to compare
   * @returns - whether the two addresses are imitators
   */
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
