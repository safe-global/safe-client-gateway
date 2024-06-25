import { Inject, Injectable, Module } from '@nestjs/common';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { GPv2Decoder } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import {
  ITokenRepository,
  TokenRepositoryModule,
} from '@/domain/tokens/token.repository.interface';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';
import { Token, TokenType } from '@/domain/tokens/entities/token.entity';
import { Order, OrderKind } from '@/domain/swaps/entities/order.entity';
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
  private static readonly NATIVE_CURRENCY_ADDRESS =
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

  private readonly restrictApps: boolean =
    this.configurationService.getOrThrow('swaps.restrictApps');

  private readonly swapsExplorerBaseUri: string =
    this.configurationService.getOrThrow('swaps.explorerBaseUri');

  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly gpv2Decoder: GPv2Decoder,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(ISwapsRepository)
    private readonly swapsRepository: ISwapsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject('SWAP_ALLOWED_APPS') private readonly allowedApps: Set<string>,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  // TODO: Refactor findSwapOrder, findSwapTransfer and findTwapOrder to avoid code duplication

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
   * The returned object represents the order.
   *
   * @throws {Error} Throws an error if the order `kind` is 'unknown'.
   * @throws {Error} Throws an error if either the sellToken or buyToken object has null decimals.
   */
  async getOrder(args: {
    chainId: string;
    orderUid: `0x${string}`;
  }): Promise<Order & { kind: Exclude<Order['kind'], 'unknown'> }> {
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
   * Checks if the app associated with an order is allowed.
   *
   * @param order - the order to which we should verify the app data with
   * @returns true if the app is allowed, false otherwise.
   */
  isAppAllowed(order: Order): boolean {
    if (!this.restrictApps) return true;
    const appCode = order.fullAppData?.appCode;
    return (
      !!appCode && typeof appCode === 'string' && this.allowedApps.has(appCode)
    );
  }

  private isSwapOrder(transaction: { data?: `0x${string}` }): boolean {
    if (!transaction.data) return false;
    return this.gpv2Decoder.helpers.isSetPreSignature(transaction.data);
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

function allowedAppsFactory(
  configurationService: IConfigurationService,
): Set<string> {
  const allowedApps =
    configurationService.getOrThrow<string[]>('swaps.allowedApps');
  return new Set(allowedApps);
}

@Module({
  imports: [
    ChainsRepositoryModule,
    SwapsRepositoryModule,
    TokenRepositoryModule,
  ],
  providers: [
    SwapOrderHelper,
    MultiSendDecoder,
    GPv2Decoder,
    {
      provide: 'SWAP_ALLOWED_APPS',
      useFactory: allowedAppsFactory,
      inject: [IConfigurationService],
    },
  ],
  exports: [SwapOrderHelper],
})
export class SwapOrderHelperModule {}
