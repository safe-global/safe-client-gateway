import { IConfigurationService } from '@/config/configuration.service.interface';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';
import { TransactionItem } from '@/routes/transactions/entities/transaction-item.entity';
import {
  isTransferTransactionInfo,
  TransferDirection,
  TransferTransactionInfo,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import {
  Erc20Transfer,
  isErc20Transfer,
} from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { isSwapTransferTransactionInfo } from '@/routes/transactions/swap-transfer-transaction-info.entity';
import { Inject } from '@nestjs/common';

type Erc20TransferTransactionInfo = Omit<
  TransferTransactionInfo,
  'transferInfo'
> & {
  transferInfo: Erc20Transfer;
};

export class TransferImitationMapper {
  private static ETH_DECIMALS = 18;

  private readonly isImproved: boolean;
  private readonly lookupDistance: number;
  private readonly prefixLength: number;
  private readonly suffixLength: number;
  private readonly valueTolerance: bigint;
  private readonly echoLimit: bigint;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isImproved = configurationService.getOrThrow(
      'features.improvedAddressPoisoning',
    );
    this.lookupDistance = configurationService.getOrThrow(
      'mappings.imitation.lookupDistance',
    );
    this.prefixLength = configurationService.getOrThrow(
      'mappings.imitation.prefixLength',
    );
    this.suffixLength = configurationService.getOrThrow(
      'mappings.imitation.suffixLength',
    );
    this.valueTolerance = configurationService.getOrThrow(
      'mappings.imitation.valueTolerance',
    );
    this.echoLimit = configurationService.getOrThrow(
      'mappings.imitation.echoLimit',
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
      if (!this.isErc20TransferTransactionInfo(txInfo)) {
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
        txInfo.transferInfo.imitation = false;
        mappedTransactions.unshift(item);
        continue;
      }

      const isImitation = prevItems.some((prevItem) => {
        const prevTxInfo = prevItem.transaction.txInfo;
        if (
          !this.isErc20TransferTransactionInfo(prevTxInfo) ||
          // Do not compare against previously identified imitations
          prevTxInfo.transferInfo.imitation
        ) {
          return false;
        }

        if (!this.isImproved) {
          return this.isSpoofedEvent(txInfo, prevTxInfo);
        }

        return (
          this.isSpoofedEvent(txInfo, prevTxInfo) ||
          this.isEchoImitation(txInfo, prevTxInfo)
        );
      });

      txInfo.transferInfo.imitation = isImitation;

      if (!isImitation || args.showImitations) {
        mappedTransactions.unshift(item);
      }
    }

    return mappedTransactions;
  }

  /**
   * Returns whether {@link txInfo} is fake event imitating {@link prevTxInfo}
   *
   * A tolerant value transfer to a similar vanity address is deemed an imitation.
   *
   * @param {Erc20TransferTransactionInfo} txInfo - transaction info to compare
   * @param {Erc20TransferTransactionInfo} prevTxInfo - previous transaction info
   * @returns {boolean} - whether the transaction is an imitation
   */
  isSpoofedEvent(
    txInfo: Erc20TransferTransactionInfo,
    prevTxInfo: Erc20TransferTransactionInfo,
  ): boolean {
    const value = this.formatValue(txInfo.transferInfo);
    const prevValue = this.formatValue(prevTxInfo.transferInfo);

    const isSpoofedValue = this.isImproved
      ? // Value can differ by +/- tolerance
        value <= prevValue + this.valueTolerance &&
        value >= prevValue - this.valueTolerance
      : // Value must be equal
        value === prevValue;
    if (!isSpoofedValue) {
      return false;
    }

    return this.isImitationAddress(txInfo, prevTxInfo);
  }

  /**
   * Returns whether {@link txInfo} is incoming transfer imitating {@link prevTxInfo}
   *
   * A low-value (below a defined threshold) incoming transfer of the same token
   * previously sent is deemed an imitation.
   *
   * @param {Erc20TransferTransactionInfo} txInfo - transaction info to compare
   * @param {Erc20TransferTransactionInfo} prevTxInfo - previous transaction info
   * @returns {boolean} - whether the transaction is an imitation
   */
  isEchoImitation(
    txInfo: Erc20TransferTransactionInfo,
    prevTxInfo: Erc20TransferTransactionInfo,
  ): boolean {
    // Incoming transfer imitations must be of the same token
    const isSameToken =
      txInfo.transferInfo.tokenAddress === prevTxInfo.transferInfo.tokenAddress;
    const isIncoming = txInfo.direction === TransferDirection.Incoming;
    const isPrevOutgoing = prevTxInfo.direction === TransferDirection.Outgoing;
    if (!isSameToken || !isIncoming || !isPrevOutgoing) {
      return false;
    }

    // Is imitation if value is lower than the specified threshold
    const value = this.formatValue(txInfo.transferInfo);
    const prevValue = this.formatValue(prevTxInfo.transferInfo);
    const isEchoValue = prevValue >= this.echoLimit && value <= this.echoLimit;
    if (!isEchoValue) {
      return false;
    }

    return this.isImitationAddress(txInfo, prevTxInfo);
  }

  /**
   * Returns whether the transaction info is an ERC-20 transfer
   * @param {Erc20TransferTransactionInfo} txInfo - transaction info
   * @returns {boolean} - whether an ERC-20 transfer
   */
  private isErc20TransferTransactionInfo(
    txInfo: TransactionInfo,
  ): txInfo is Erc20TransferTransactionInfo {
    return (
      (isTransferTransactionInfo(txInfo) ||
        isSwapTransferTransactionInfo(txInfo)) &&
      isErc20Transfer(txInfo.transferInfo)
    );
  }

  /**
   * Divides the given value by 10 to the power of the decimals
   * @param {string} args.value - value to format
   * @param {number|null} args.decimals - decimals to divide by
   * @returns {bigint} - formatted value
   */
  private formatValue(args: Pick<Erc20Transfer, 'value' | 'decimals'>): bigint {
    const decimals = args.decimals ?? TransferImitationMapper.ETH_DECIMALS;
    return BigInt(args.value) / BigInt(10 ** decimals);
  }

  /**
   * Returns the address of the sender or recipient according to the direction
   * @param txInfo - transaction info
   * @returns - address of sender or recipient
   */
  private getReferenceAddress(txInfo: TransferTransactionInfo): string {
    return txInfo.direction === TransferDirection.Outgoing
      ? txInfo.recipient.value
      : txInfo.sender.value;
  }

  /**
   * Returns whether the reference addresses of transactions match in vanity
   * @param {Erc20TransferTransactionInfo} txInfo - transaction info from which to compare
   * @param {Erc20TransferTransactionInfo} prevTxInfo - previous transaction from which info
   * @returns {boolean} - whether the transaction is an imitation
   */
  private isImitationAddress(
    txInfo: Erc20TransferTransactionInfo,
    prevTxInfo: Erc20TransferTransactionInfo,
  ): boolean {
    const refAddress = this.getReferenceAddress(txInfo).toLowerCase();
    const prevRefAddress = this.getReferenceAddress(prevTxInfo).toLowerCase();

    // Same address is not an imitation
    if (refAddress === prevRefAddress) {
      return false;
    }

    const isSamePrefix =
      // Ignore `0x` prefix
      refAddress.slice(2, 2 + this.prefixLength) ===
      prevRefAddress.slice(2, 2 + this.prefixLength);
    const isSameSuffix =
      refAddress.slice(-this.suffixLength) ===
      prevRefAddress.slice(-this.suffixLength);
    return isSamePrefix && isSameSuffix;
  }
}
