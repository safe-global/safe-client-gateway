import { IConfigurationService } from '@/config/configuration.service.interface';
import { IDataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository.interface';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { ComposableCowDecoder } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import { GPv2Decoder } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { OrderStatus } from '@/domain/swaps/entities/order.entity';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import {
  BaselineConfirmationView,
  ConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { CowSwapConfirmationView } from '@/routes/transactions/entities/swaps/swap-confirmation-view.entity';
import { CowSwapTwapConfirmationView } from '@/routes/transactions/entities/swaps/twap-confirmation-view.entity';
import { NativeStakingDepositConfirmationView } from '@/routes/transactions/entities/staking/native-staking-deposit-confirmation-view.entity';
import { NativeStakingValidatorsExitConfirmationView } from '@/routes/transactions/entities/staking/native-staking-validators-exit-confirmation-view.entity';
import { NativeStakingWithdrawConfirmationView } from '@/routes/transactions/entities/staking/native-staking-withdraw-confirmation-view.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { KilnNativeStakingHelper } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { SwapAppsHelper } from '@/routes/transactions/helpers/swap-apps.helper';
import { SwapOrderHelper } from '@/routes/transactions/helpers/swap-order.helper';
import { TwapOrderHelper } from '@/routes/transactions/helpers/twap-order.helper';
import { NativeStakingMapper } from '@/routes/transactions/mappers/common/native-staking.mapper';
import { Inject, Injectable } from '@nestjs/common';

@Injectable({})
export class TransactionsViewService {
  private readonly isNativeStakingEnabled: boolean;

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
    private readonly swapAppsHelper: SwapAppsHelper,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly kilnNativeStakingHelper: KilnNativeStakingHelper,
    private readonly nativeStakingMapper: NativeStakingMapper,
    private readonly kilnDecoder: KilnDecoder,
  ) {
    this.isNativeStakingEnabled = this.configurationService.getOrThrow<boolean>(
      'features.nativeStaking',
    );
  }

  async getTransactionConfirmationView(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    transactionDataDto: TransactionDataDto;
  }): Promise<ConfirmationView> {
    const dataDecoded = await this.dataDecodedRepository
      .getDataDecoded({
        chainId: args.chainId,
        data: args.transactionDataDto.data,
        to: args.transactionDataDto.to,
      })
      .catch(() => {
        // TODO: Remove after Kiln has verified contracts
        // Fallback for unverified contracts
        return {
          method: '',
          parameters: null,
        };
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

    const nativeStakingDepositTransaction =
      this.isNativeStakingEnabled &&
      this.kilnNativeStakingHelper.findDepositTransaction({
        to: args.transactionDataDto.to,
        data: args.transactionDataDto.data,
        // Value is always defined
        value: args.transactionDataDto.value ?? '0',
      });

    const nativeStakingValidatorsExitTransaction =
      this.isNativeStakingEnabled &&
      this.kilnNativeStakingHelper.findValidatorsExitTransaction({
        to: args.transactionDataDto.to,
        data: args.transactionDataDto.data,
        // Value is always defined
        value: args.transactionDataDto.value ?? '0',
      });

    const nativeStakingWithdrawTransaction =
      this.isNativeStakingEnabled &&
      this.kilnNativeStakingHelper.findWithdrawTransaction({
        to: args.transactionDataDto.to,
        data: args.transactionDataDto.data,
        // Value is always defined
        value: args.transactionDataDto.value ?? '0',
      });

    if (
      !swapOrderData &&
      !twapSwapOrderData &&
      !nativeStakingDepositTransaction &&
      !nativeStakingValidatorsExitTransaction &&
      !nativeStakingWithdrawTransaction
    ) {
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
      } else if (
        nativeStakingDepositTransaction &&
        nativeStakingDepositTransaction.to
      ) {
        return await this.getNativeStakingDepositConfirmationView({
          to: nativeStakingDepositTransaction.to,
          data: nativeStakingDepositTransaction.data,
          chainId: args.chainId,
          dataDecoded,
          value: nativeStakingDepositTransaction.value,
        });
      } else if (
        nativeStakingValidatorsExitTransaction &&
        nativeStakingValidatorsExitTransaction.to
      ) {
        return await this.getNativeStakingValidatorsExitConfirmationView({
          to: nativeStakingValidatorsExitTransaction.to,
          data: nativeStakingValidatorsExitTransaction.data,
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          dataDecoded,
        });
      } else if (
        nativeStakingWithdrawTransaction &&
        nativeStakingWithdrawTransaction.to
      ) {
        return await this.getNativeStakingWithdrawConfirmationView({
          to: nativeStakingWithdrawTransaction.to,
          data: nativeStakingWithdrawTransaction.data,
          safeAddress: args.safeAddress,
          chainId: args.chainId,
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

    const order = await this.swapOrderHelper.getOrder({
      chainId: args.chainId,
      orderUid,
    });

    if (!this.swapAppsHelper.isAppAllowed(order)) {
      throw new Error(`Unsupported App: ${order.fullAppData?.appCode}`);
    }

    const [sellToken, buyToken] = await Promise.all([
      this.swapOrderHelper.getToken({
        chainId: args.chainId,
        address: order.sellToken,
      }),
      this.swapOrderHelper.getToken({
        chainId: args.chainId,
        address: order.buyToken,
      }),
    ]);

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
      explorerUrl: this.swapOrderHelper.getOrderExplorerUrl(order).toString(),
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

    // Decode hash of `appData`
    const fullAppData = await this.swapsRepository.getFullAppData(
      args.chainId,
      twapStruct.appData,
    );

    if (!this.swapAppsHelper.isAppAllowed(fullAppData)) {
      throw new Error(`Unsupported App: ${fullAppData.fullAppData?.appCode}`);
    }

    const [buyToken, sellToken] = await Promise.all([
      this.swapOrderHelper.getToken({
        chainId: args.chainId,
        address: twapStruct.buyToken,
      }),
      this.swapOrderHelper.getToken({
        chainId: args.chainId,
        address: twapStruct.sellToken,
      }),
    ]);

    return new CowSwapTwapConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      status: OrderStatus.PreSignaturePending,
      kind: twapOrderData.kind,
      class: twapOrderData.class,
      activeOrderUid: null,
      validUntil: Math.max(...twapParts.map((order) => order.validTo)),
      sellAmount: twapOrderData.sellAmount,
      buyAmount: twapOrderData.buyAmount,
      executedSellAmount: '0',
      executedBuyAmount: '0',
      executedSurplusFee: '0',
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
      fullAppData: fullAppData.fullAppData,
      numberOfParts: twapOrderData.numberOfParts,
      partSellAmount: twapStruct.partSellAmount.toString(),
      minPartLimit: twapStruct.minPartLimit.toString(),
      timeBetweenParts: twapOrderData.timeBetweenParts,
      durationOfPart: twapOrderData.durationOfPart,
      startTime: twapOrderData.startTime,
    });
  }

  private async getNativeStakingDepositConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
    value: string | null;
  }): Promise<NativeStakingDepositConfirmationView> {
    const dataDecoded =
      args.dataDecoded.method !== ''
        ? args.dataDecoded
        : this.kilnDecoder.decodeDeposit(args.data);
    if (!dataDecoded) {
      throw new Error('Transaction data could not be decoded');
    }
    const depositInfo = await this.nativeStakingMapper.mapDepositInfo({
      chainId: args.chainId,
      to: args.to,
      value: args.value,
      txHash: null,
    });
    return new NativeStakingDepositConfirmationView({
      method: dataDecoded.method,
      parameters: dataDecoded.parameters,
      ...depositInfo,
    });
  }

  private async getNativeStakingValidatorsExitConfirmationView(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<NativeStakingValidatorsExitConfirmationView> {
    const dataDecoded =
      args.dataDecoded.method !== ''
        ? args.dataDecoded
        : this.kilnDecoder.decodeValidatorsExit(args.data);
    if (!dataDecoded) {
      throw new Error('Transaction data could not be decoded');
    }
    const validatorsExitInfo =
      await this.nativeStakingMapper.mapValidatorsExitInfo({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        to: args.to,
        data: args.data,
      });

    return new NativeStakingValidatorsExitConfirmationView({
      method: dataDecoded.method,
      parameters: dataDecoded.parameters,
      ...validatorsExitInfo,
    });
  }

  private async getNativeStakingWithdrawConfirmationView(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<NativeStakingWithdrawConfirmationView> {
    const dataDecoded =
      args.dataDecoded.method !== ''
        ? args.dataDecoded
        : this.kilnDecoder.decodeBatchWithdrawCLFee(args.data);
    if (!dataDecoded) {
      throw new Error('Transaction data could not be decoded');
    }
    const withdrawInfo = await this.nativeStakingMapper.mapWithdrawInfo({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      to: args.to,
      data: args.data,
      txHash: null,
    });
    return new NativeStakingWithdrawConfirmationView({
      method: dataDecoded.method,
      parameters: dataDecoded.parameters,
      ...withdrawInfo,
    });
  }
}
