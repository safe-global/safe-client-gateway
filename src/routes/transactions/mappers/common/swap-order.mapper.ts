import { Injectable, Module } from '@nestjs/common';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import { SwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import {
  SwapOrderHelper,
  SwapOrderHelperModule,
} from '@/routes/transactions/helpers/swap-order.helper';

@Injectable()
export class SwapOrderMapper {
  constructor(
    private readonly setPreSignatureDecoder: SetPreSignatureDecoder,
    private readonly swapOrderHelper: SwapOrderHelper,
  ) {}

  async mapSwapOrder(
    chainId: string,
    transaction: { data: `0x${string}` },
  ): Promise<SwapOrderTransactionInfo> {
    const orderUid: `0x${string}` | null =
      this.setPreSignatureDecoder.getOrderUid(transaction.data);
    if (!orderUid) {
      throw new Error('Order UID not found in transaction data');
    }

    const { order, sellToken, buyToken } = await this.swapOrderHelper.getOrder({
      chainId,
      orderUid,
    });

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
      explorerUrl: this.swapOrderHelper.getOrderExplorerUrl(order),
      executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
    });
  }
}

@Module({
  imports: [SwapOrderHelperModule],
  providers: [SwapOrderMapper, SetPreSignatureDecoder],
  exports: [SwapOrderMapper],
})
export class SwapOrderMapperModule {}
