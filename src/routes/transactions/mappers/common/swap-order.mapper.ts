import { Inject, Injectable, Module } from '@nestjs/common';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import { isHex } from 'viem';
import {
  DefaultSwapOrderTransactionInfo,
  FulfilledSwapOrderTransactionInfo,
  SwapOrderTransactionInfo,
  TokenInfo,
} from '@/routes/transactions/entities/swap-order-info.entity';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { CustomTransactionMapper } from '@/routes/transactions/mappers/common/custom-transaction.mapper';
import { CustomTransactionInfo } from '@/routes/transactions/entities/custom-transaction.entity';
import { Token } from '@/domain/tokens/entities/token.entity';
import { SwapsRepository } from '@/domain/swaps/swaps.repository';
import { SwapsModule } from '@/domain/swaps/swaps.module';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { Order } from '@/domain/swaps/entities/order.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * Represents the amount of a token in a swap order.
 */
class TokenAmount {
  readonly token: Token & {
    decimals: number;
  };
  private readonly amount: bigint;
  private readonly executedAmount: bigint;

  constructor(args: { token: Token; amount: bigint; executedAmount: bigint }) {
    if (args.token.decimals === null)
      throw new Error(`Token ${args.token.address} has no decimals set.`);

    this.token = { ...args.token, decimals: args.token.decimals };
    this.amount = args.amount;
    this.executedAmount = args.executedAmount;
  }

  getAmount(): number {
    return asDecimal(this.amount, this.token.decimals);
  }

  getExecutedAmount(): number {
    return asDecimal(this.executedAmount, this.token.decimals);
  }

  toTokenInfo(): TokenInfo {
    return new TokenInfo({
      amount: this.getAmount().toString(),
      symbol: this.token.symbol,
      logo: this.token.logoUri,
    });
  }
}

function asDecimal(amount: number | bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

@Injectable()
export class SwapOrderMapper {
  private readonly swapsExplorerBaseUri: string =
    this.configurationService.getOrThrow('swaps.explorerBaseUri');

  constructor(
    private readonly swapsRepository: SwapsRepository,
    private readonly setPreSignatureDecoder: SetPreSignatureDecoder,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    private readonly customTransactionMapper: CustomTransactionMapper,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  async mapSwapOrder(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
    dataSize: number,
  ): Promise<SwapOrderTransactionInfo | CustomTransactionInfo> {
    if (!isHex(transaction.data)) {
      return this._mapUnknownOrderStatus(chainId, transaction, dataSize);
    }

    const orderUid: `0x${string}` | null =
      this.setPreSignatureDecoder.getOrderUid(transaction.data);
    if (!orderUid) {
      return this._mapUnknownOrderStatus(chainId, transaction, dataSize);
    }

    try {
      const order = await this.swapsRepository.getOrder(chainId, orderUid);
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

      const buyTokenAmount = new TokenAmount({
        token: buyToken,
        amount: order.buyAmount,
        executedAmount: order.executedBuyAmount,
      });
      const sellTokenAmount = new TokenAmount({
        token: sellToken,
        amount: order.sellAmount,
        executedAmount: order.executedSellAmount,
      });

      switch (order.status) {
        case 'fulfilled':
          return this._mapFulfilledOrderStatus({
            buyToken: buyTokenAmount,
            sellToken: sellTokenAmount,
            order,
          });
        case 'open':
        case 'cancelled':
        case 'expired':
          return this._mapDefaultOrderStatus({
            buyToken: buyTokenAmount,
            sellToken: sellTokenAmount,
            order,
          });
        default:
          return this._mapUnknownOrderStatus(chainId, transaction, dataSize);
      }
    } catch (e) {
      this.loggingService.warn(e);
      return this.customTransactionMapper.mapCustomTransaction(
        transaction,
        dataSize,
        chainId,
        null,
        null,
      );
    }
  }

  private _mapUnknownOrderStatus(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
    dataSize: number,
  ): Promise<CustomTransactionInfo> {
    return this.customTransactionMapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      null,
      null,
    );
  }

  private _getExecutionPriceLabel(
    sellToken: TokenAmount,
    buyToken: TokenAmount,
  ): string {
    const ratio = sellToken.getExecutedAmount() / buyToken.getExecutedAmount();
    return `1 ${sellToken.token.symbol} = ${ratio} ${buyToken.token.symbol}`;
  }

  private _getLimitPriceLabel(
    sellToken: TokenAmount,
    buyToken: TokenAmount,
  ): string {
    const ratio = sellToken.getAmount() / buyToken.getAmount();
    return `1 ${sellToken.token.symbol} = ${ratio} ${buyToken.token.symbol}`;
  }

  /**
   * Returns the filled percentage of an order.
   * The percentage is calculated as the ratio of the executed amount to the total amount.
   *
   * @param order - The order to calculate the filled percentage for.
   * @private
   */
  private _getFilledPercentage(order: Order): string {
    let executed: number;
    let total: number;
    if (order.kind === 'buy') {
      executed = Number(order.executedBuyAmount);
      total = Number(order.buyAmount);
    } else if (order.kind === 'sell') {
      executed = Number(order.executedSellAmount);
      total = Number(order.sellAmount);
    } else {
      throw new Error('Unknown order kind');
    }

    return ((executed / total) * 100).toFixed(2).toString();
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

  private _mapFulfilledOrderStatus(args: {
    buyToken: TokenAmount;
    sellToken: TokenAmount;
    order: Order;
  }): SwapOrderTransactionInfo {
    if (args.order.kind === 'unknown') {
      throw new Error('Unknown order kind');
    }
    const surplusFeeLabel: string | null = args.order.executedSurplusFee
      ? this._getExecutedSurplusFeeLabel(
          args.order.executedSurplusFee,
          args.buyToken.token,
        )
      : null;

    return new FulfilledSwapOrderTransactionInfo({
      orderUid: args.order.uid,
      orderKind: args.order.kind,
      sellToken: args.sellToken.toTokenInfo(),
      buyToken: args.buyToken.toTokenInfo(),
      expiresTimestamp: args.order.validTo,
      surplusFeeLabel: surplusFeeLabel,
      executionPriceLabel: this._getExecutionPriceLabel(
        args.sellToken,
        args.buyToken,
      ),
      filledPercentage: this._getFilledPercentage(args.order),
      explorerUrl: this._getOrderExplorerUrl(args.order),
    });
  }

  private _getExecutedSurplusFeeLabel(
    executedSurplusFee: bigint,
    token: Token & { decimals: number },
  ): string {
    const surplus = asDecimal(executedSurplusFee, token.decimals);
    return `${surplus} ${token.symbol}`;
  }

  private _mapDefaultOrderStatus(args: {
    buyToken: TokenAmount;
    sellToken: TokenAmount;
    order: Order;
  }): SwapOrderTransactionInfo {
    if (args.order.kind === 'unknown') {
      throw new Error('Unknown order kind');
    }
    if (
      args.order.status === 'fulfilled' ||
      args.order.status === 'presignaturePending' ||
      args.order.status === 'unknown'
    )
      throw new Error(
        `${args.order.status} orders should not be mapped as default orders. Order UID = ${args.order.uid}`,
      );
    return new DefaultSwapOrderTransactionInfo({
      orderUid: args.order.uid,
      status: args.order.status,
      orderKind: args.order.kind,
      sellToken: args.sellToken.toTokenInfo(),
      buyToken: args.buyToken.toTokenInfo(),
      expiresTimestamp: args.order.validTo,
      limitPriceLabel: this._getLimitPriceLabel(args.sellToken, args.buyToken),
      filledPercentage: this._getFilledPercentage(args.order),
      explorerUrl: this._getOrderExplorerUrl(args.order),
    });
  }
}

@Module({
  // TODO AddressInfoModule is not needed in this module but it is required by the CustomTransactionMapper.
  //  The CustomTransactionMapper (module to be created) should be the one providing it instead.
  imports: [SwapsModule, AddressInfoModule],
  providers: [SwapOrderMapper, SetPreSignatureDecoder, CustomTransactionMapper],
  exports: [SwapOrderMapper],
})
export class SwapOrderMapperModule {}
