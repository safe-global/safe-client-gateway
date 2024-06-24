import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import {
  ComposableCowDecoder,
  TwapStruct,
} from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import {
  BuyTokenBalance,
  OrderKind,
  SellTokenBalance,
} from '@/domain/swaps/entities/order.entity';
import { GPv2OrderParameters } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { Injectable, Module } from '@nestjs/common';
import { isAddressEqual } from 'viem';

/**
 *
 * @see https://github.com/cowprotocol/contracts/blob/1465e69f6935b3ef9ce45d4878e44f0335ef8531/src/ts/order.ts
 */
@Injectable()
export class TwapOrderHelper {
  private static readonly ComposableCowAddress =
    '0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74' as const;

  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly composableCowDecoder: ComposableCowDecoder,
  ) {}

  /**
   * Finds a TWAP order in a given transaction, either directly called or in a MultiSend
   *
   * @param args.to - recipient of the transaction
   * @param args.data - data of the transaction
   * @returns TWAP order data if found, otherwise null
   */
  public findTwapOrder(args: {
    to: `0x${string}`;
    data: `0x${string}`;
  }): `0x${string}` | null {
    if (this.isTwapOrder(args)) {
      return args.data;
    }

    if (this.multiSendDecoder.helpers.isMultiSend(args.data)) {
      const transactions = this.multiSendDecoder.mapMultiSendTransactions(
        args.data,
      );

      for (const transaction of transactions) {
        if (this.isTwapOrder(transaction)) {
          return transaction.data;
        }
      }
    }

    return null;
  }

  private isTwapOrder(args: {
    to: `0x${string}`;
    data: `0x${string}`;
  }): boolean {
    return (
      isAddressEqual(args.to, TwapOrderHelper.ComposableCowAddress) &&
      this.composableCowDecoder.helpers.isCreateWithContext(args.data)
    );
  }

  /**
   * Generates TWAP order parts based on the given TWAP struct and its execution date.
   *
   * @param args.twapStruct - {@link TwapStruct} (decoded `staticInput` of `createWithContext`)
   * @param args.executionDate - date of the TWAP execution
   * @param args.chainId - chain ID of the TWAP
   * @returns array of {@link GPv2OrderParameters} that represent the TWAP order parts
   *
   * Implementation based on CoW Swap app
   * @see https://github.com/cowprotocol/cowswap/blob/1cdfa24c6448e3ebf2c6e3c986cb5d7bfd269aa4/apps/cowswap-frontend/src/modules/twap/updaters/PartOrdersUpdater.tsx#L44
   */
  public generateTwapOrderParts(args: {
    twapStruct: TwapStruct;
    executionDate: Date;
    chainId: string;
  }): Array<GPv2OrderParameters> {
    return Array.from({ length: Number(args.twapStruct.n) }, (_, index) => {
      return {
        sellToken: args.twapStruct.sellToken,
        buyToken: args.twapStruct.buyToken,
        receiver: args.twapStruct.receiver,
        sellAmount: args.twapStruct.partSellAmount,
        buyAmount: args.twapStruct.minPartLimit,
        validTo: this.calculateValidTo({
          part: index,
          startTime: Math.ceil(args.executionDate.getTime() / 1_000),
          span: Number(args.twapStruct.span),
          frequency: Number(args.twapStruct.t),
        }),
        appData: args.twapStruct.appData,
        feeAmount: BigInt('0'),
        kind: OrderKind.Sell,
        partiallyFillable: false,
        sellTokenBalance: SellTokenBalance.Erc20,
        buyTokenBalance: BuyTokenBalance.Erc20,
      };
    });
  }

  private calculateValidTo(args: {
    part: number;
    startTime: number;
    frequency: number;
    span: number;
  }): number {
    const validityPeriod =
      args.span === 0
        ? (args.part + 1) * args.frequency - 1
        : args.part * args.frequency + args.span - 1;

    return args.startTime + validityPeriod;
  }
}

@Module({
  imports: [],
  providers: [ComposableCowDecoder, MultiSendDecoder, TwapOrderHelper],
  exports: [TwapOrderHelper],
})
export class TwapOrderHelperModule {}
