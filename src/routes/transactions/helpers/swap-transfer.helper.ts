import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { GPv2Decoder } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SwapTransferHelper {
  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly gpv2Decoder: GPv2Decoder,
  ) {}

  // TODO: Refactor findSwapOrder, findSwapTransfer and findTwapOrder to avoid code duplication

  /**
   * Finds the `settle` transaction in provided data.
   * The call can either be direct or parsed from within a MultiSend batch.
   *
   * @param data - transaction data to search for the `settle` transaction in
   * @returns transaction data of `settle` transaction if found, otherwise null
   */
  public findSwapTransfer(data: `0x${string}`): `0x${string}` | null {
    if (this.gpv2Decoder.helpers.isSettle(data)) {
      return data;
    }

    if (this.multiSendDecoder.helpers.isMultiSend(data)) {
      const transactions = this.multiSendDecoder.mapMultiSendTransactions(data);
      for (const transaction of transactions) {
        if (this.gpv2Decoder.helpers.isSettle(transaction.data)) {
          return transaction.data;
        }
      }
    }

    return null;
  }
}
