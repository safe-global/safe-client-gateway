import { Injectable, Module } from '@nestjs/common';
import { GPv2Decoder } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { SwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  SwapOrderHelper,
  SwapOrderHelperModule,
} from '@/routes/transactions/helpers/swap-order.helper';
import { GPv2OrderHelper } from '@/routes/transactions/helpers/gp-v2-order.helper';

@Injectable()
export class SwapOrderMapper {
  constructor(
    private readonly gpv2Decoder: GPv2Decoder,
    private readonly gpv2OrderHelper: GPv2OrderHelper,
    private readonly swapOrderHelper: SwapOrderHelper,
  ) {}

  async mapSwapOrder(
    chainId: string,
    transaction: { data: `0x${string}` },
  ): Promise<SwapOrderTransactionInfo> {
    const orderUid: `0x${string}` | null =
      this.gpv2Decoder.getOrderUidFromSetPreSignature(transaction.data);
    if (!orderUid) {
      throw new Error('Order UID not found in transaction data');
    }

    return await this.mapSwapOrderTransactionInfo({ chainId, orderUid });
  }

  async mapTwapSwapOrder(
    chainId: string,
    safeAddress: `0x${string}`,
    transaction: { data: `0x${string}` },
  ): Promise<SwapOrderTransactionInfo> {
    const order = this.gpv2Decoder.decodeOrderFromSettlement(transaction.data);
    if (!order) {
      throw new Error('Order could not be decoded from transaction data');
    }

    const orderUid = this.gpv2OrderHelper.computeOrderUid({
      chainId,
      owner: safeAddress,
      order,
    });
    return await this.mapSwapOrderTransactionInfo({ chainId, orderUid });
  }

  private async mapSwapOrderTransactionInfo(args: {
    chainId: string;
    orderUid: `0x${string}`;
  }): Promise<SwapOrderTransactionInfo> {
    const { order, sellToken, buyToken } =
      await this.swapOrderHelper.getOrder(args);

    if (!this.swapOrderHelper.isAppAllowed(order)) {
      throw new Error(`Unsupported App: ${order.fullAppData?.appCode}`);
    }

    return new SwapOrderTransactionInfo({
      uid: order.uid,
      orderStatus: order.status,
      kind: order.kind,
      class: order.class,
      validUntil: order.validTo,
      sellAmount: order.sellAmount.toString(),
      buyAmount: order.buyAmount.toString(),
      executedSellAmount: order.executedSellAmount.toString(),
      executedBuyAmount: order.executedBuyAmount.toString(),
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
      explorerUrl: this.swapOrderHelper.getOrderExplorerUrl(order).toString(),
      executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
      receiver: order.receiver,
      owner: order.owner,
      fullAppData: order.fullAppData,
    });
  }
}

@Module({
  imports: [SwapOrderHelperModule],
  providers: [SwapOrderMapper, GPv2Decoder, GPv2OrderHelper],
  exports: [SwapOrderMapper],
})
export class SwapOrderMapperModule {}
