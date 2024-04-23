import { Inject, Injectable, Module } from '@nestjs/common';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import {
  ITokenRepository,
  TokenRepositoryModule,
} from '@/domain/tokens/token.repository.interface';
import {
  ISwapsRepository,
  SwapsRepository,
} from '@/domain/swaps/swaps.repository';
import { Token } from '@/domain/tokens/entities/token.entity';
import { Order } from '@/domain/swaps/entities/order.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { SwapsRepositoryModule } from '@/domain/swaps/swaps-repository.module';

@Injectable()
export class SwapOrderHelper {
  private readonly swapsExplorerBaseUri: string =
    this.configurationService.getOrThrow('swaps.explorerBaseUri');

  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly setPreSignatureDecoder: SetPreSignatureDecoder,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(ISwapsRepository) private readonly swapsRepository: SwapsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  /**
   * Finds the swap order in the transaction data.
   * The swap order can be in the transaction data directly or in the data of a Multisend transaction.
   *
   * @param data - The transaction data
   * @private
   * @returns The swap order if found, otherwise null
   */
  public findSwapOrder(data: `0x${string}`): `0x${string}` | null {
    // The swap order can be in the transaction data directly
    if (this.isSwapOrder({ data })) {
      return data;
    }
    // or in the data of a multisend transaction
    if (this.multiSendDecoder.helpers.isMultiSend(data)) {
      const transactions = this.multiSendDecoder.mapMultiSendTransactions(data);
      // TODO If we can build a sorted hash map of the transactions, we can avoid iterating all of them
      //  as we know the pattern of a Swap Order.
      for (const transaction of transactions) {
        if (this.isSwapOrder(transaction)) {
          return transaction.data;
        }
      }
    }
    return null;
  }

  /**
   * Retrieves detailed information about a specific order and its associated tokens
   *
   * @param {Object} args - The arguments required to fetch the order.
   * @param {string} args.chainId - The network chain ID.
   * @param {string} args.orderUid - The unique identifier of the order, prefixed with '0x'.
   * @returns {Promise} A promise that resolves to an object containing the order and token details.
   *
   * The returned object includes:
   * - `order`: An object representing the order.
   * - `sellToken`: The Token object with a mandatory `decimals` property
   * - `buyToken`: Similar to `sellToken`, for the token being purchased in the order.
   *
   * @throws {Error} Throws an error if the order `kind` is 'unknown'.
   * @throws {Error} Throws an error if either the sellToken or buyToken object has null decimals.
   */
  async getOrder(args: { chainId: string; orderUid: `0x${string}` }): Promise<{
    order: Order & { kind: Exclude<Order['kind'], 'unknown'> };
    sellToken: Token & { decimals: number };
    buyToken: Token & { decimals: number };
  }> {
    const order = await this.swapsRepository.getOrder(
      args.chainId,
      args.orderUid,
    );

    if (order.kind === 'unknown') throw new Error('Unknown order kind');

    const [buyToken, sellToken] = await Promise.all([
      this.tokenRepository.getToken({
        chainId: args.chainId,
        address: order.buyToken,
      }),
      this.tokenRepository.getToken({
        chainId: args.chainId,
        address: order.sellToken,
      }),
    ]);

    if (buyToken.decimals === null || sellToken.decimals === null) {
      throw new Error('Invalid token decimals');
    }

    return {
      order: { ...order, kind: order.kind },
      buyToken: { ...buyToken, decimals: buyToken.decimals },
      sellToken: { ...sellToken, decimals: sellToken.decimals },
    };
  }

  /**
   * Returns the URL to the explorer page of an order.
   *
   * @param order - The order to get the explorer URL for.
   * @private
   */
  getOrderExplorerUrl(order: Order): URL {
    const url = new URL(this.swapsExplorerBaseUri);
    url.pathname = `/orders/${order.uid}`;
    return url;
  }

  private isSwapOrder(transaction: { data?: `0x${string}` }): boolean {
    if (!transaction.data) return false;
    return this.setPreSignatureDecoder.isSetPreSignature(transaction.data);
  }
}

@Module({
  imports: [SwapsRepositoryModule, TokenRepositoryModule],
  providers: [SwapOrderHelper, MultiSendDecoder, SetPreSignatureDecoder],
  exports: [SwapOrderHelper],
})
export class SwapOrderHelperModule {}
