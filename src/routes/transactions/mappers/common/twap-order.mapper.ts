import { Inject, Injectable, Module } from '@nestjs/common';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  SwapOrderHelper,
  SwapOrderHelperModule,
} from '@/routes/transactions/helpers/swap-order.helper';
import { ComposableCowDecoder } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import {
  DurationType,
  StartTimeValue,
  TwapOrderInfo,
  TwapOrderTransactionInfo,
} from '@/routes/transactions/entities/swaps/twap-order-info.entity';
import {
  TwapOrderHelper,
  TwapOrderHelperModule,
} from '@/routes/transactions/helpers/twap-order.helper';
import {
  OrderClass,
  OrderKind,
  OrderStatus,
} from '@/domain/swaps/entities/order.entity';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';
import { SwapsRepositoryModule } from '@/domain/swaps/swaps-repository.module';
import { SwapOrderMapperModule } from '@/routes/transactions/mappers/common/swap-order.mapper';
import { GPv2OrderHelper } from '@/routes/transactions/helpers/gp-v2-order.helper';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class TwapOrderMapper {
  private maxNumberOfParts = 11;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly swapOrderHelper: SwapOrderHelper,
    @Inject(ISwapsRepository)
    private readonly swapsRepository: ISwapsRepository,
    private readonly composableCowDecoder: ComposableCowDecoder,
    private readonly gpv2OrderHelper: GPv2OrderHelper,
    private readonly twapOrderHelper: TwapOrderHelper,
  ) {
    this.maxNumberOfParts = this.configurationService.getOrThrow(
      'swaps.maxNumberOfParts',
    );
  }

  /**
   * Maps a TWAP order from a given transaction
   *
   * @param chainId - chain the order is on
   * @param safeAddress - "owner" of the order
   * @param transaction - transaction data and execution date
   * @returns mapped {@link TwapOrderTransactionInfo}
   */
  async mapTwapOrder(
    chainId: string,
    safeAddress: `0x${string}`,
    transaction: { data: `0x${string}`; executionDate: Date },
  ): Promise<TwapOrderTransactionInfo> {
    // Decode `staticInput` of `createWithContextCall`
    const twapStruct = this.composableCowDecoder.decodeTwapStruct(
      transaction.data,
    );

    // Generate parts of the TWAP order
    const _parts = this.twapOrderHelper.generateTwapOrderParts({
      twapStruct,
      executionDate: transaction.executionDate,
      chainId,
    });

    // There can be up to uint256 parts in a TWAP order so we limit this
    // to avoid requesting too many orders
    const hasAbundantParts = _parts.length > this.maxNumberOfParts;

    const parts = hasAbundantParts
      ? // We use the last part (and only one) to get the status of the entire
        // order and we only need one to get the token info
        _parts.slice(-1)
      : _parts;

    const [{ fullAppData }, ...orders] = await Promise.all([
      // Decode hash of `appData`
      this.swapsRepository.getFullAppData(chainId, twapStruct.appData),
      // Fetch all order parts
      ...parts.map((order) => {
        const orderUid = this.gpv2OrderHelper.computeOrderUid({
          chainId,
          owner: safeAddress,
          order,
        });
        return this.swapOrderHelper.getOrder({ chainId, orderUid });
      }),
    ]);

    const executedSellAmount: TwapOrderInfo['executedSellAmount'] =
      hasAbundantParts ? null : this.getExecutedSellAmount(orders).toString();

    const executedBuyAmount: TwapOrderInfo['executedBuyAmount'] =
      hasAbundantParts ? null : this.getExecutedBuyAmount(orders).toString();

    // All orders have the same sellToken and buyToken
    const { sellToken, buyToken } = orders[0];

    const { n: numberOfParts, partSellAmount, minPartLimit } = twapStruct;
    const span = Number(twapStruct.span);
    const sellAmount = partSellAmount * numberOfParts;
    const buyAmount = minPartLimit * numberOfParts;

    return new TwapOrderTransactionInfo({
      orderStatus: this.getOrderStatus(orders),
      kind: OrderKind.Sell,
      class: OrderClass.Limit,
      validUntil: Math.max(...parts.map((order) => order.validTo)),
      sellAmount: sellAmount.toString(),
      buyAmount: buyAmount.toString(),
      executedSellAmount,
      executedBuyAmount,
      sellToken: new TokenInfo({
        address: sellToken.address,
        decimals: sellToken.decimals,
        logoUri: sellToken.logoUri,
        name: sellToken.name,
        symbol: sellToken.symbol,
        trusted: sellToken.trusted,
      }),
      buyToken: new TokenInfo({
        address: buyToken.address,
        decimals: buyToken.decimals,
        logoUri: buyToken.logoUri,
        name: buyToken.name,
        symbol: buyToken.symbol,
        trusted: buyToken.trusted,
      }),
      receiver: twapStruct.receiver,
      owner: safeAddress,
      fullAppData,
      numberOfParts: Number(numberOfParts),
      partSellAmount: partSellAmount.toString(),
      minPartLimit: minPartLimit.toString(),
      timeBetweenParts: twapStruct.t.toString(),
      durationOfPart: this.getDurationOfPart(span),
      startTime: this.getStartTime({ span, startEpoch: Number(twapStruct.t0) }),
    });
  }

  private getOrderStatus(
    orders: Array<Awaited<ReturnType<typeof this.swapOrderHelper.getOrder>>>,
  ): OrderStatus {
    // If an order is fulfilled, cancelled or expired, the part is "complete"
    const completeStatuses = [
      OrderStatus.Fulfilled,
      OrderStatus.Cancelled,
      OrderStatus.Expired,
    ];

    for (let i = 0; i < orders.length; i++) {
      const { order } = orders[i];

      // Return the status of the last part
      if (i === orders.length - 1) {
        return order.status;
      }

      // If the part is complete, continue to the next part
      if (completeStatuses.includes(order.status)) {
        continue;
      }

      return order.status;
    }

    return OrderStatus.Unknown;
  }

  private getExecutedSellAmount(
    orders: Array<Awaited<ReturnType<typeof this.swapOrderHelper.getOrder>>>,
  ): number {
    return orders.reduce((acc, { order }) => {
      return acc + Number(order.executedSellAmount);
    }, 0);
  }

  private getExecutedBuyAmount(
    orders: Array<Awaited<ReturnType<typeof this.swapOrderHelper.getOrder>>>,
  ): number {
    return orders.reduce((acc, { order }) => {
      return acc + Number(order.executedBuyAmount);
    }, 0);
  }

  private getDurationOfPart(span: number): TwapOrderInfo['durationOfPart'] {
    if (span === 0) {
      return { durationType: DurationType.Auto };
    }
    return { durationType: DurationType.LimitDuration, duration: span };
  }

  private getStartTime(args: {
    span: number;
    startEpoch: number;
  }): TwapOrderInfo['startTime'] {
    if (args.span === 0) {
      return { startType: StartTimeValue.AtMiningTime };
    }
    return { startType: StartTimeValue.AtEpoch, epoch: args.startEpoch };
  }
}

@Module({
  imports: [
    SwapOrderHelperModule,
    SwapsRepositoryModule,
    SwapOrderMapperModule,
    TwapOrderHelperModule,
  ],
  providers: [ComposableCowDecoder, GPv2OrderHelper, TwapOrderMapper],
  exports: [TwapOrderMapper],
})
export class TwapOrderMapperModule {}
