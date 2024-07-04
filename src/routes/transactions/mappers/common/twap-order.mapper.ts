import { Inject, Injectable, Module } from '@nestjs/common';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  SwapOrderHelper,
  SwapOrderHelperModule,
} from '@/routes/transactions/helpers/swap-order.helper';
import { ComposableCowDecoder } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import {
  TwapOrderInfo,
  TwapOrderTransactionInfo,
} from '@/routes/transactions/entities/swaps/twap-order-info.entity';
import {
  TwapOrderHelper,
  TwapOrderHelperModule,
} from '@/routes/transactions/helpers/twap-order.helper';
import {
  KnownOrder,
  OrderKind,
  OrderStatus,
} from '@/domain/swaps/entities/order.entity';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';
import { SwapsRepositoryModule } from '@/domain/swaps/swaps-repository.module';
import { SwapOrderMapperModule } from '@/routes/transactions/mappers/common/swap-order.mapper';
import { GPv2OrderHelper } from '@/routes/transactions/helpers/gp-v2-order.helper';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

@Injectable()
export class TwapOrderMapper {
  private maxNumberOfParts: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
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
    transaction: { data: `0x${string}`; executionDate: Date | null },
  ): Promise<TwapOrderTransactionInfo> {
    // Decode `staticInput` of `createWithContextCall`
    const twapStruct = this.composableCowDecoder.decodeTwapStruct(
      transaction.data,
    );
    const twapOrderData =
      this.twapOrderHelper.twapStructToPartialOrderInfo(twapStruct);

    // Generate parts of the TWAP order
    const twapParts = this.twapOrderHelper.generateTwapOrderParts({
      twapStruct,
      executionDate: transaction.executionDate ?? new Date(),
      chainId,
    });

    // There can be up to uint256 parts in a TWAP order so we limit this
    // to avoid requesting too many orders
    const hasAbundantParts = twapParts.length > this.maxNumberOfParts;

    // Fetch all order parts if the transaction has been executed, otherwise none
    const partsToFetch = transaction.executionDate
      ? hasAbundantParts
        ? // We use the last part (and only one) to get the status of the entire
          // order and we only need one to get the token info
          twapParts.slice(-1)
        : twapParts
      : [];

    const fullAppData = await this.swapsRepository.getFullAppData(
      chainId,
      twapStruct.appData,
    );

    const orders: Array<KnownOrder> = [];

    for (const part of partsToFetch) {
      const orderUid = this.gpv2OrderHelper.computeOrderUid({
        chainId,
        owner: safeAddress,
        order: part,
      });

      try {
        const order = await this.swapsRepository.getOrder(chainId, orderUid);
        const partFullAppData = await this.swapsRepository.getFullAppData(
          chainId,
          part.appData,
        );
        if (!this.twapOrderHelper.isAppAllowed(partFullAppData)) {
          throw new Error(
            `Unsupported App: ${partFullAppData.fullAppData?.appCode}`,
          );
        }

        if (order.kind === OrderKind.Buy || order.kind === OrderKind.Sell) {
          orders.push(order as KnownOrder);
        }
      } catch (err) {
        this.loggingService.warn(
          `Error getting orderUid ${orderUid} from SwapsRepository`,
        );
      }
    }

    if (!this.twapOrderHelper.isAppAllowed(fullAppData)) {
      throw new Error(`Unsupported App: ${fullAppData.fullAppData?.appCode}`);
    }
    // TODO: Calling `getToken` directly instead of multiple times in `getOrder` for sellToken and buyToken

    const executedSellAmount: TwapOrderInfo['executedSellAmount'] =
      hasAbundantParts ? null : this.getExecutedSellAmount(orders).toString();

    const executedBuyAmount: TwapOrderInfo['executedBuyAmount'] =
      hasAbundantParts ? null : this.getExecutedBuyAmount(orders).toString();

    const executedSurplusFee: TwapOrderInfo['executedSurplusFee'] =
      hasAbundantParts ? null : this.getExecutedSurplusFee(orders).toString();

    const [sellToken, buyToken] = await Promise.all([
      this.swapOrderHelper.getToken({
        chainId,
        address: twapStruct.sellToken,
      }),
      this.swapOrderHelper.getToken({
        chainId,
        address: twapStruct.buyToken,
      }),
    ]);

    return new TwapOrderTransactionInfo({
      status: this.getOrderStatus(orders),
      kind: twapOrderData.kind,
      class: twapOrderData.class,
      validUntil: Math.max(...twapParts.map((order) => order.validTo)),
      sellAmount: twapOrderData.sellAmount,
      buyAmount: twapOrderData.buyAmount,
      executedSellAmount,
      executedBuyAmount,
      executedSurplusFee,
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
      fullAppData: fullAppData.fullAppData,
      numberOfParts: twapOrderData.numberOfParts,
      partSellAmount: twapStruct.partSellAmount.toString(),
      minPartLimit: twapStruct.minPartLimit.toString(),
      timeBetweenParts: twapOrderData.timeBetweenParts,
      durationOfPart: twapOrderData.durationOfPart,
      startTime: twapOrderData.startTime,
    });
  }

  private getOrderStatus(
    orders: Array<Awaited<ReturnType<typeof this.swapOrderHelper.getOrder>>>,
  ): OrderStatus {
    if (orders.length === 0) {
      return OrderStatus.PreSignaturePending;
    }

    // If an order is fulfilled, cancelled or expired, the part is "complete"
    const completeStatuses = [
      OrderStatus.Fulfilled,
      OrderStatus.Cancelled,
      OrderStatus.Expired,
    ];

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];

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

  private getExecutedSellAmount(orders: Array<KnownOrder>): bigint {
    return orders.reduce((acc, order) => {
      return acc + BigInt(order.executedSellAmount);
    }, BigInt(0));
  }

  private getExecutedBuyAmount(orders: Array<KnownOrder>): bigint {
    return orders.reduce((acc, order) => {
      return acc + BigInt(order.executedBuyAmount);
    }, BigInt(0));
  }

  private getExecutedSurplusFee(orders: Array<KnownOrder>): bigint {
    return orders.reduce((acc, order) => {
      return acc + BigInt(order.executedSurplusFee ?? BigInt(0));
    }, BigInt(0));
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
