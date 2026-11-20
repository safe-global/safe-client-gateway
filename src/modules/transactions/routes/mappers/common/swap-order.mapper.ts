// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable, Module } from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import { GPv2Decoder } from '#/modules/swaps/domain/contracts/decoders/gp-v2-decoder.helper';
import type { KnownOrder } from '#/modules/swaps/domain/entities/order.entity';
import type { Token } from '#/modules/tokens/domain/entities/token.entity';
import { SwapOrderTransactionInfo } from '#/modules/transactions/routes/entities/swaps/swap-order-info.entity';
import { TokenInfo } from '#/modules/transactions/routes/entities/swaps/token-info.entity';
import {
  SwapAppsHelper,
  SwapAppsHelperModule,
} from '#/modules/transactions/routes/helpers/swap-apps.helper';
import {
  type SwapOrderCalls,
  SwapOrderHelper,
  SwapOrderHelperModule,
} from '#/modules/transactions/routes/helpers/swap-order.helper';

@Injectable()
export class SwapOrderMapper {
  constructor(
    private readonly gpv2Decoder: GPv2Decoder,
    private readonly swapOrderHelper: SwapOrderHelper,
    private readonly swapAppsHelper: SwapAppsHelper,
  ) {}

  async mapSwapOrder(
    chainId: string,
    orderCalls: SwapOrderCalls,
  ): Promise<SwapOrderTransactionInfo> {
    const orderUid: Address | null =
      this.gpv2Decoder.getOrderUidFromSetPreSignature(orderCalls.preSignature);
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

    this.assertCallsMatchOrder({ orderCalls, order, sellToken });

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

  /**
   * Checks the approvals and wraps batched with the presignature against the order:
   * they must be for its sell token, and wraps only of a trusted token.
   * The wrapped amount is not checked, as it may differ from the order's sell amount.
   */
  private assertCallsMatchOrder(args: {
    orderCalls: SwapOrderCalls;
    order: KnownOrder;
    sellToken: Token;
  }): void {
    const { orderCalls, order, sellToken } = args;
    const isSellToken = (token: Address): boolean =>
      isAddressEqual(token, order.sellToken);

    if (!orderCalls.approvedTokens.every(isSellToken)) {
      throw new Error('Approval is not for the order sell token');
    }

    if (orderCalls.wrappedTokens.length === 0) {
      return;
    }

    const isOrderWrap =
      sellToken.trusted && orderCalls.wrappedTokens.every(isSellToken);

    if (!isOrderWrap) {
      throw new Error('Wrap does not match the order sell token');
    }
  }
}

@Module({
  imports: [SwapOrderHelperModule, SwapAppsHelperModule],
  providers: [SwapOrderMapper, GPv2Decoder],
  exports: [SwapOrderMapper],
})
export class SwapOrderMapperModule {}
