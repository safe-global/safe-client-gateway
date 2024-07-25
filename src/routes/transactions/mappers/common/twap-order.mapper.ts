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
import {
  SwapAppsHelper,
  SwapAppsHelperModule,
} from '@/routes/transactions/helpers/swap-apps.helper';
import { GPv2OrderParameters } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';

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
    private readonly swapAppsHelper: SwapAppsHelper,
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

    const fullAppData = await this.swapsRepository.getFullAppData(
      chainId,
      twapStruct.appData,
    );

    if (!this.swapAppsHelper.isAppAllowed(fullAppData)) {
      throw new Error(`Unsupported App: ${fullAppData.fullAppData?.appCode}`);
    }

    // There can be up to uint256 parts in a TWAP order so we limit this
    // to avoid requesting too many orders
    const hasAbundantParts = twapParts.length > this.maxNumberOfParts;

    // Fetch all order parts if the transaction has been executed, otherwise none
    const partsToFetch = transaction.executionDate
      ? hasAbundantParts
        ? // We use the last part (and only one) to get the amounts/fees of the entire
          // order and we only need one to get the token info
          twapParts.slice(-1)
        : twapParts
      : [];

    const activePart = this.getActivePart({
      twapParts,
      executionDate: transaction.executionDate,
    });

    const activeOrderUid = activePart
      ? this.gpv2OrderHelper.computeOrderUid({
          chainId: chainId,
          owner: safeAddress,
          order: activePart,
        })
      : null;

    const partOrders = await this.getPartOrders({
      partsToFetch,
      chainId,
      safeAddress,
    });

    const status = await this.getOrderStatus({
      chainId,
      safeAddress,
      twapParts,
      partOrders,
      activeOrderUid,
      executionDate: transaction.executionDate,
    });

    const executedSellAmount: TwapOrderInfo['executedSellAmount'] =
      hasAbundantParts || !partOrders
        ? null
        : this.getExecutedSellAmount(partOrders).toString();

    const executedBuyAmount: TwapOrderInfo['executedBuyAmount'] =
      hasAbundantParts || !partOrders
        ? null
        : this.getExecutedBuyAmount(partOrders).toString();

    const executedSurplusFee: TwapOrderInfo['executedSurplusFee'] =
      hasAbundantParts || !partOrders
        ? null
        : this.getExecutedSurplusFee(partOrders).toString();

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
      status,
      kind: twapOrderData.kind,
      class: twapOrderData.class,
      activeOrderUid,
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

  private getActivePart(args: {
    twapParts: Array<GPv2OrderParameters>;
    executionDate: Date | null;
  }): GPv2OrderParameters | null {
    if (!args.executionDate) {
      return null;
    }

    const now = new Date();
    const activePart = args.twapParts.find((part) => {
      return part.validTo > Math.floor(now.getTime() / 1_000);
    });

    return activePart ?? null;
  }

  private async getPartOrders(args: {
    partsToFetch: Array<GPv2OrderParameters>;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<KnownOrder> | null> {
    const orders: Array<KnownOrder> = [];

    for (const part of args.partsToFetch) {
      const partFullAppData = await this.swapsRepository.getFullAppData(
        args.chainId,
        part.appData,
      );

      if (!this.swapAppsHelper.isAppAllowed(partFullAppData)) {
        throw new Error(
          `Unsupported App: ${partFullAppData.fullAppData?.appCode}`,
        );
      }

      const orderUid = this.gpv2OrderHelper.computeOrderUid({
        chainId: args.chainId,
        owner: args.safeAddress,
        order: part,
      });
      const order = await this.swapsRepository
        .getOrder(args.chainId, orderUid)
        .catch(() => {
          this.loggingService.warn(
            `Error getting orderUid ${orderUid} from SwapsRepository`,
          );
        });

      if (!order || order.kind == OrderKind.Unknown) {
        // Without every order it's not possible to determine executed amounts/fees
        return null;
      }

      if (!this.swapAppsHelper.isAppAllowed(order)) {
        throw new Error(`Unsupported App: ${order.fullAppData?.appCode}`);
      }

      orders.push(order as KnownOrder);
    }

    return orders;
  }

  private async getOrderStatus(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    twapParts: Array<GPv2OrderParameters>;
    partOrders: Array<KnownOrder> | null;
    activeOrderUid: `0x${string}` | null;
    executionDate: Date | null;
  }): Promise<OrderStatus> {
    if (!args.executionDate) {
      return OrderStatus.PreSignaturePending;
    }

    // Note: TWAPs can never "expire" in their entirety, only parts can but
    // this does not affect TWAP status

    const finalOrderUid = this.gpv2OrderHelper.computeOrderUid({
      chainId: args.chainId,
      owner: args.safeAddress,
      order: args.twapParts.slice(-1)[0], // Last TWAP part
    });

    // If active order is final one, it's fulfilled as it exists
    if (args.activeOrderUid === finalOrderUid) {
      return OrderStatus.Fulfilled;
    }

    // Check active or final order part depending on whether the TWAP is active
    const orderUidToCheck = args.activeOrderUid ?? finalOrderUid;

    try {
      // If we already fetched the order, we don't need to again
      const orderAlreadyFetched = !!args.partOrders?.some(
        (order) => order.uid === orderUidToCheck,
      );
      if (!orderAlreadyFetched) {
        await this.swapsRepository.getOrder(args.chainId, orderUidToCheck);
      }

      // If the order exists, the TWAP is either open or fulfilled depending
      // on whether the order is active
      return args.activeOrderUid ? OrderStatus.Open : OrderStatus.Fulfilled;
    } catch {
      // If the order doesn't exist, it means the TWAP was cancelled
      return OrderStatus.Cancelled;
    }
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
    SwapAppsHelperModule,
  ],
  providers: [ComposableCowDecoder, GPv2OrderHelper, TwapOrderMapper],
  exports: [TwapOrderMapper],
})
export class TwapOrderMapperModule {}
