import { Injectable, Module } from '@nestjs/common';
import { GPv2Decoder } from '@/modules/swaps/domain/contracts/decoders/gp-v2-decoder.helper';
import { SwapOrderTransactionInfo } from '@/modules/transactions/routes/entities/swaps/swap-order-info.entity';
import { TokenInfo } from '@/modules/transactions/routes/entities/swaps/token-info.entity';
import {
  SwapOrderHelper,
  SwapOrderHelperModule,
} from '@/modules/transactions/routes/helpers/swap-order.helper';
import {
  SwapAppsHelper,
  SwapAppsHelperModule,
} from '@/modules/transactions/routes/helpers/swap-apps.helper';
import type { Address } from 'viem';

@Injectable()
export class SwapOrderMapper {
  constructor(
    private readonly gpv2Decoder: GPv2Decoder,
    private readonly swapOrderHelper: SwapOrderHelper,
    private readonly swapAppsHelper: SwapAppsHelper,
  ) {}

  async mapSwapOrder(
    chainId: string,
    transaction: { data: Address },
  ): Promise<SwapOrderTransactionInfo> {
    const orderUid: Address | null =
      this.gpv2Decoder.getOrderUidFromSetPreSignature(transaction.data);
    if (!orderUid) {
      throw new Error('Order UID not found in transaction data');
    }
    const order = await this.swapOrderHelper.getOrder({ chainId, orderUid });

    if (!this.swapAppsHelper.isAppAllowed(order)) {
      throw new Error(`Unsupported App: ${order.fullAppData?.appCode}`);
    }

    const [sellToken, buyToken] = await Promise.all([
      this.swapOrderHelper.getToken({
        address: order.sellToken,
        chainId,
      }),
      this.swapOrderHelper.getToken({
        address: order.buyToken,
        chainId,
      }),
    ]);

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
      executedFee: order.executedFee.toString(),
      executedFeeToken: new TokenInfo({
        address: sellToken.address,
        decimals: sellToken.decimals,
        logoUri: sellToken.logoUri,
        name: sellToken.name,
        symbol: sellToken.symbol,
        trusted: sellToken.trusted,
      }),
      receiver: order.receiver,
      owner: order.owner,
      fullAppData: order.fullAppData,
    });
  }
}

@Module({
  imports: [SwapOrderHelperModule, SwapAppsHelperModule],
  providers: [SwapOrderMapper, GPv2Decoder],
  exports: [SwapOrderMapper],
})
export class SwapOrderMapperModule {}
