import { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import {
  BaselineConfirmationView,
  ConfirmationView,
  CowSwapConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IDataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository.interface';
import { SwapOrderHelper } from '@/routes/transactions/helpers/swap-order.helper';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

@Injectable({})
export class TransactionsViewService {
  constructor(
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: IDataDecodedRepository,
    private readonly setPreSignatureDecoder: SetPreSignatureDecoder,
    private readonly swapOrderHelper: SwapOrderHelper,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async getTransactionConfirmationView(args: {
    chainId: string;
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

    if (!swapOrderData) {
      return new BaselineConfirmationView({
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
    }

    try {
      return await this.handleSwapOrder({
        chainId: args.chainId,
        data: swapOrderData,
        dataDecoded,
      });
    } catch (error) {
      this.loggingService.warn(error);
      return new BaselineConfirmationView({
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
    }
  }

  private async handleSwapOrder(args: {
    chainId: string;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<CowSwapConfirmationView> {
    const orderUid: `0x${string}` | null =
      this.setPreSignatureDecoder.getOrderUid(args.data);
    if (!orderUid) {
      throw new Error('Order UID not found in transaction data');
    }

    const { order, sellToken, buyToken } = await this.swapOrderHelper.getOrder({
      chainId: args.chainId,
      orderUid,
    });

    return new CowSwapConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      uid: order.uid,
      orderStatus: order.status,
      kind: order.kind,
      class: order.class,
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
    });
  }
}
