import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { Injectable, Module } from '@nestjs/common';

@Injectable()
export class TransactionDataFinder {
  constructor(private readonly multiSendDecoder: MultiSendDecoder) {}

  /**
   * Finds transaction data in a given transaction, if directly called or in a MultiSend
   *
   * @param isTransactionData - function to determine if the transaction data is the one we are looking for
   * @param transaction - transaction to search for the data
   * @returns transaction data if found, otherwise null
   */
  public findTransactionData(
    isTransactionData: (args: {
      to?: `0x${string}`;
      data: `0x${string}`;
    }) => boolean,
    transaction: { to?: `0x${string}`; data: `0x${string}` },
  ): `0x${string}` | null {
    if (isTransactionData(transaction)) {
      return transaction.data;
    }

    if (this.multiSendDecoder.helpers.isMultiSend(transaction.data)) {
      const batchedTransaction = this.multiSendDecoder
        .mapMultiSendTransactions(transaction.data)
        .find(isTransactionData);

      if (batchedTransaction) {
        return batchedTransaction.data;
      }
    }

    return null;
  }
}

@Module({
  imports: [],
  providers: [TransactionDataFinder, MultiSendDecoder],
  exports: [TransactionDataFinder],
})
export class TransactionDataFinderModule {}
