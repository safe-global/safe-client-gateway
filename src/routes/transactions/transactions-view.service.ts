import { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import {
  BaselineConfirmationView,
  ConfirmationView,
  CowSwapConfirmationView,
  CowSwapTwapConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IDataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository.interface';
import { SwapOrderHelper } from '@/routes/transactions/helpers/swap-order.helper';
import { GPv2Decoder } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { TwapOrderHelper } from '@/routes/transactions/helpers/twap-order.helper';
import { OrderStatus } from '@/domain/swaps/entities/order.entity';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';
import { ComposableCowDecoder } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';

@Injectable({})
export class TransactionsViewService {
  constructor(
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: IDataDecodedRepository,
    private readonly gpv2Decoder: GPv2Decoder,
    private readonly swapOrderHelper: SwapOrderHelper,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly twapOrderHelper: TwapOrderHelper,
    @Inject(ISwapsRepository)
    private readonly swapsRepository: ISwapsRepository,
    private readonly composableCowDecoder: ComposableCowDecoder,
  ) {}

  async getTransactionConfirmationView(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    transactionDataDto: TransactionDataDto;
  }): Promise<ConfirmationView> {
    const dataDecoded = await this.dataDecodedRepository.getDataDecoded({
      chainId: args.chainId,
      data: args.transactionDataDto.data,
      to: args.transactionDataDto.to,
    });

    const swapOrderData = this.swapOrderHelper.findSwapOrder(
      args.transactionDataDto.data,
    );

    const twapSwapOrderData = args.transactionDataDto.to
      ? this.twapOrderHelper.findTwapOrder({
          to: args.transactionDataDto.to,
          data: args.transactionDataDto.data,
        })
      : null;

    if (!swapOrderData && !twapSwapOrderData) {
      return new BaselineConfirmationView({
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
    }

    try {
      if (swapOrderData) {
        return await this.getSwapOrderConfirmationView({
          chainId: args.chainId,
          data: swapOrderData,
          dataDecoded,
        });
      } else if (twapSwapOrderData) {
        return await this.getTwapOrderConfirmationView({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          data: twapSwapOrderData,
          dataDecoded,
        });
      } else {
        // Should not reach here
        throw new Error('No swap order data found');
      }
    } catch (error) {
      this.loggingService.warn(error);
      return new BaselineConfirmationView({
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
    }
  }

  private async getSwapOrderConfirmationView(args: {
    chainId: string;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<CowSwapConfirmationView> {
    const orderUid: `0x${string}` | null =
      this.gpv2Decoder.getOrderUidFromSetPreSignature(args.data);
    if (!orderUid) {
      throw new Error('Order UID not found in transaction data');
    }

    const { order, sellToken, buyToken } = await this.swapOrderHelper.getOrder({
      chainId: args.chainId,
      orderUid,
    });

    if (!this.swapOrderHelper.isAppAllowed(order)) {
      throw new Error(`Unsupported App: ${order.fullAppData?.appCode}`);
    }

    return new CowSwapConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      uid: order.uid,
      status: order.status,
      kind: order.kind,
      orderClass: order.class,
      validUntil: order.validTo,
      sellAmount: order.sellAmount.toString(),
      buyAmount: order.buyAmount.toString(),
      executedSellAmount: order.executedSellAmount.toString(),
      executedBuyAmount: order.executedBuyAmount.toString(),
      explorerUrl: this.swapOrderHelper.getOrderExplorerUrl(order),
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
      executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
      receiver: order.receiver,
      owner: order.owner,
      fullAppData: order.fullAppData,
    });
  }

  private async getTwapOrderConfirmationView(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<CowSwapTwapConfirmationView> {
    // Decode `staticInput` of `createWithContextCall`
    const twapStruct = this.composableCowDecoder.decodeTwapStruct(args.data);
    const twapOrderData =
      this.twapOrderHelper.twapStructToPartialOrderInfo(twapStruct);

    // Generate parts of the TWAP order
    const twapParts = this.twapOrderHelper.generateTwapOrderParts({
      twapStruct,
      executionDate: new Date(),
      chainId: args.chainId,
    });

    const [{ fullAppData }, buyToken, sellToken] = await Promise.all([
      // Decode hash of `appData`
      this.swapsRepository.getFullAppData(args.chainId, twapStruct.appData),
      this.swapOrderHelper.getToken({
        chainId: args.chainId,
        address: twapStruct.buyToken,
      }),
      this.swapOrderHelper.getToken({
        chainId: args.chainId,
        address: twapStruct.sellToken,
      }),
    ]);

    // TODO: Handling of restricted Apps

    return new CowSwapTwapConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      status: OrderStatus.PreSignaturePending,
      kind: twapOrderData.kind,
      class: twapOrderData.class,
      validUntil: Math.max(...twapParts.map((order) => order.validTo)),
      sellAmount: twapOrderData.sellAmount,
      buyAmount: twapOrderData.buyAmount,
      executedSellAmount: '0',
      executedBuyAmount: '0',
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
      owner: args.safeAddress,
      fullAppData,
      numberOfParts: twapOrderData.numberOfParts,
      partSellAmount: twapStruct.partSellAmount.toString(),
      minPartLimit: twapStruct.minPartLimit.toString(),
      timeBetweenParts: twapOrderData.timeBetweenParts,
      durationOfPart: twapOrderData.durationOfPart,
      startTime: twapOrderData.startTime,
    });
  }
}
