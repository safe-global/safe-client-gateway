import { TransactionDataFinder } from '@/routes/transactions/helpers/transaction-data-finder.helper';
import {
  ComposableCowDecoder,
  TwapStruct,
} from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import {
  BuyTokenBalance,
  OrderClass,
  OrderKind,
  SellTokenBalance,
} from '@/domain/swaps/entities/order.entity';
import {
  DurationType,
  StartTimeValue,
  DurationOfPart,
  StartTime,
  TwapOrderInfo,
} from '@/routes/transactions/entities/swaps/twap-order-info.entity';
import { GPv2OrderParameters } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { Inject, Injectable, Module } from '@nestjs/common';
import { isAddressEqual } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { FullAppData } from '@/domain/swaps/entities/full-app-data.entity';

/**
 *
 * @see https://github.com/cowprotocol/contracts/blob/1465e69f6935b3ef9ce45d4878e44f0335ef8531/src/ts/order.ts
 */
@Injectable()
export class TwapOrderHelper {
  private static readonly ComposableCowAddress =
    '0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74' as const;

  private readonly restrictApps: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly transactionDataFinder: TransactionDataFinder,
    private readonly composableCowDecoder: ComposableCowDecoder,
    @Inject('SWAP_ALLOWED_APPS') private readonly allowedApps: Set<string>,
  ) {
    this.restrictApps =
      this.configurationService.getOrThrow<boolean>('swaps.restrictApps');
  }

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
    return this.transactionDataFinder.findTransactionData(({ to, data }) => {
      return (
        !!to &&
        isAddressEqual(to, TwapOrderHelper.ComposableCowAddress) &&
        this.composableCowDecoder.helpers.isCreateWithContext(data)
      );
    }, args);
  }

  /**
   * Maps values of {@link TwapStruct} to partial {@link TwapOrderInfo}
   *
   * @param struct - {@link TwapStruct} to map
   * @returns partial mapping of {@link TwapOrderInfo}
   */
  public twapStructToPartialOrderInfo(
    struct: TwapStruct,
  ): Pick<
    TwapOrderInfo,
    | 'kind'
    | 'class'
    | 'sellAmount'
    | 'buyAmount'
    | 'startTime'
    | 'numberOfParts'
    | 'timeBetweenParts'
    | 'durationOfPart'
  > {
    const {
      n: numberOfParts,
      partSellAmount,
      minPartLimit,
      t: timeBetweenParts,
      t0: startEpoch,
      span,
    } = struct;

    const sellAmount = partSellAmount * numberOfParts;
    const buyAmount = minPartLimit * numberOfParts;

    const isSpanZero = Number(span) === 0;
    const durationOfPart: DurationOfPart = isSpanZero
      ? { durationType: DurationType.Auto }
      : { durationType: DurationType.LimitDuration, duration: span.toString() };

    const startTime: StartTime = isSpanZero
      ? { startType: StartTimeValue.AtMiningTime }
      : { startType: StartTimeValue.AtEpoch, epoch: Number(startEpoch) };

    return {
      kind: OrderKind.Sell,
      class: OrderClass.Limit,
      sellAmount: sellAmount.toString(),
      buyAmount: buyAmount.toString(),
      startTime,
      numberOfParts: numberOfParts.toString(),
      timeBetweenParts: Number(timeBetweenParts),
      durationOfPart,
    };
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

  /**
   * Checks if the app associated contained in fullAppData is allowed.
   *
   * @param fullAppData - object to which we should verify the app data with
   * @returns true if the app is allowed, false otherwise.
   */
  // TODO: Refactor with confirmation view, swaps and TWAPs
  public isAppAllowed(fullAppData: FullAppData): boolean {
    if (!this.restrictApps) return true;
    const appCode = fullAppData.fullAppData?.appCode;
    return (
      !!appCode && typeof appCode === 'string' && this.allowedApps.has(appCode)
    );
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

function allowedAppsFactory(
  configurationService: IConfigurationService,
): Set<string> {
  const allowedApps =
    configurationService.getOrThrow<string[]>('swaps.allowedApps');
  return new Set(allowedApps);
}

@Module({
  imports: [],
  providers: [
    ComposableCowDecoder,
    TransactionDataFinder,
    TwapOrderHelper,
    {
      provide: 'SWAP_ALLOWED_APPS',
      useFactory: allowedAppsFactory,
      inject: [IConfigurationService],
    },
  ],
  exports: [TwapOrderHelper],
})
export class TwapOrderHelperModule {}
