import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { Injectable, Module } from '@nestjs/common';
import type { Address, Hex } from 'viem';

@Injectable()
export class TransactionFinder {
  constructor(private readonly multiSendDecoder: MultiSendDecoder) {}

  /**
   * Finds transaction data in a given transaction, if directly called or in a MultiSend
   *
   * @param isTransactionData - function to determine if the transaction data is the one we are looking for
   * @param transaction - transaction to search for the data
   * @returns transaction data if found, otherwise null
   */
  public findTransaction(
    isTransactionData: (args: { to?: Address; data: Hex }) => boolean,
    transaction: { to?: Address; data: Hex; value: string },
  ): { to?: Address; data: Hex; value: string } | null {
    if (isTransactionData(transaction)) {
      return transaction;
    }

    if (this.multiSendDecoder.helpers.isMultiSend(transaction.data)) {
      const batchedTransaction = this.multiSendDecoder
        .mapMultiSendTransactions(transaction.data)
        .find(isTransactionData);

      if (batchedTransaction) {
        return {
          to: batchedTransaction.to,
          data: batchedTransaction.data,
          value: batchedTransaction.value.toString(),
        };
      }
    }

    return null;
  }
}

@Module({
  imports: [],
  providers: [TransactionFinder, MultiSendDecoder],
  exports: [TransactionFinder],
})
export class TransactionFinderModule {}
