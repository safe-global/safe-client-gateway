import { Inject, Injectable, Module } from '@nestjs/common';
import {
  TransactionDataFinder,
  TransactionDataFinderModule,
} from '@/routes/transactions/helpers/transaction-data-finder.helper';
import { GPv2Decoder } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import {
  ITokenRepository,
  TokenRepositoryModule,
} from '@/domain/tokens/token.repository.interface';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';
import { Token, TokenType } from '@/domain/tokens/entities/token.entity';
import {
  KnownOrder,
  Order,
  OrderKind,
} from '@/domain/swaps/entities/order.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { SwapsRepositoryModule } from '@/domain/swaps/swaps-repository.module';
import {
  ChainsRepositoryModule,
  IChainsRepository,
} from '@/domain/chains/chains.repository.interface';

@Injectable()
export class SwapOrderHelper {
  // This is the Native Currency address considered by CoW Swap
  // https://docs.cow.fi/cow-protocol/reference/sdks/cow-sdk/modules#buy_eth_address
  public static readonly NATIVE_CURRENCY_ADDRESS =
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

  private readonly swapsExplorerBaseUri: string =
    this.configurationService.getOrThrow('swaps.explorerBaseUri');

  constructor(
    private readonly transactionDataFinder: TransactionDataFinder,
    private readonly gpv2Decoder: GPv2Decoder,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(ISwapsRepository)
    private readonly swapsRepository: ISwapsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
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
    return this.transactionDataFinder.findTransactionData(
      (transaction) =>
        this.gpv2Decoder.helpers.isSetPreSignature(transaction.data),
      { data },
    );
  }

  /**
   * Retrieves detailed information about a specific order and its associated tokens
   *
   * @param {Object} args - The arguments required to fetch the order.
   * @param {string} args.chainId - The network chain ID.
   * @param {string} args.orderUid - The unique identifier of the order, prefixed with '0x'.
   * @returns {Promise} A promise that resolves to an object containing the order and token details.
   *
   * The returned object represents the order.
   *
   * @throws {Error} Throws an error if the order `kind` is 'unknown'.
   * @throws {Error} Throws an error if either the sellToken or buyToken object has null decimals.
   */
  async getOrder(args: {
    chainId: string;
    orderUid: `0x${string}`;
  }): Promise<KnownOrder> {
    const order = await this.swapsRepository.getOrder(
      args.chainId,
      args.orderUid,
    );

    if (order.kind === OrderKind.Unknown) throw new Error('Unknown order kind');

    return {
      ...order,
      kind: order.kind,
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

  /**
   * Retrieves a token object based on the provided Ethereum chain ID and token address.
   * If the specified address is the placeholder for the native currency of the chain,
   * it fetches the chain's native currency details from the {@link IChainsRepository}.
   * Otherwise, it fetches the token details from the {@link ITokenRepository}.
   *
   * @param args An object containing:
   *   - `chainId`: A string representing the ID of the blockchain chain.
   *   - `address`: A string representing the Ethereum address of the token, prefixed with '0x'.
   * @returns {Promise<Token>} A promise that resolves to a Token object containing the details
   * of either the native currency or the specified token with mandatory decimals.
   * @throws {Error} Throws an error if the token data cannot be retrieved.
   * @async
   */
  public async getToken(args: {
    chainId: string;
    address: `0x${string}`;
  }): Promise<Token & { decimals: NonNullable<Token['decimals']> }> {
    // We perform lower case comparison because the provided address (3rd party service)
    // might not be checksummed.
    if (
      args.address.toLowerCase() ===
      SwapOrderHelper.NATIVE_CURRENCY_ADDRESS.toLowerCase()
    ) {
      const { nativeCurrency } = await this.chainsRepository.getChain(
        args.chainId,
      );
      return {
        address: SwapOrderHelper.NATIVE_CURRENCY_ADDRESS,
        decimals: nativeCurrency.decimals,
        logoUri: nativeCurrency.logoUri,
        name: nativeCurrency.name,
        symbol: nativeCurrency.symbol,
        type: TokenType.NativeToken,
        trusted: true,
      };
    } else {
      const token = await this.tokenRepository.getToken({
        chainId: args.chainId,
        address: args.address,
      });

      if (token.decimals === null) {
        throw new Error('Invalid token decimals');
      }

      return { ...token, decimals: token.decimals };
    }
  }
}

@Module({
  imports: [
    ChainsRepositoryModule,
    SwapsRepositoryModule,
    TokenRepositoryModule,
    TransactionDataFinderModule,
  ],
  providers: [SwapOrderHelper, GPv2Decoder],
  exports: [SwapOrderHelper],
})
export class SwapOrderHelperModule {}
