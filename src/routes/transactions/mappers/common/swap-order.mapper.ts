import { Inject, Injectable, Module } from '@nestjs/common';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import {
  SwapOrderTransactionInfo,
  TokenInfo,
} from '@/routes/transactions/entities/swap-order-info.entity';
import {
  ITokenRepository,
  TokenRepositoryModule,
} from '@/domain/tokens/token.repository.interface';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';
import { SwapsModule } from '@/domain/swaps/swaps.module';
import { Order } from '@/domain/swaps/entities/order.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class SwapOrderMapper {
  private readonly swapsExplorerBaseUri: string =
    this.configurationService.getOrThrow('swaps.explorerBaseUri');

  constructor(
    @Inject(ISwapsRepository)
    private readonly swapsRepository: ISwapsRepository,
    private readonly setPreSignatureDecoder: SetPreSignatureDecoder,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
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

    const order = await this.swapsRepository.getOrder(chainId, orderUid);
    if (order.kind === 'unknown') {
      throw new Error('Unknown order kind');
    }

    const [buyToken, sellToken] = await Promise.all([
      this.tokenRepository.getToken({
        chainId,
        address: order.buyToken,
      }),
      this.tokenRepository.getToken({
        chainId,
        address: order.sellToken,
      }),
    ]);

    if (sellToken.decimals === null || buyToken.decimals === null) {
      throw new Error('Invalid token decimals');
    }

    return new SwapOrderTransactionInfo({
      uid: order.uid,
      status: order.status,
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
      explorerUrl: this._getOrderExplorerUrl(order),
      executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
    });
  }

  /**
   * Returns the URL to the explorer page of an order.
   *
   * @param order - The order to get the explorer URL for.
   * @private
   */
  private _getOrderExplorerUrl(order: Order): URL {
    const url = new URL(this.swapsExplorerBaseUri);
    url.pathname = `/orders/${order.uid}`;
    return url;
  }
}

@Module({
  imports: [SwapsModule, TokenRepositoryModule],
  providers: [SwapOrderMapper, SetPreSignatureDecoder],
  exports: [SwapOrderMapper],
})
export class SwapOrderMapperModule {}
