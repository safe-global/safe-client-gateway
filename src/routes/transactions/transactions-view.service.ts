import { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import {
  BaselineConfirmationView,
  ConfirmationView,
  CowSwapConfirmationView,
  CowSwapTwapConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
import { SwapAppsHelper } from '@/routes/transactions/helpers/swap-apps.helper';
import { KilnPooledStakingHelper } from '@/routes/transactions/helpers/kiln-pooled-staking.helper';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NativeStakingMapper } from '@/routes/transactions/mappers/common/native-staking.mapper';
import { PooledStakingMapper } from '@/routes/transactions/mappers/common/pooled-staking.mapper';
import { NativeStakingDepositConfirmationView } from '@/routes/transactions/entities/staking/dedicated-staking-confirmation-view.entity';
import {
  PooledStakingStakeConfirmationView,
  PooledStakingRequestExitConfirmationView,
  PooledStakingWithdrawConfirmationView,
} from '@/routes/transactions/entities/staking/pooled-confirmation-view.entity';
import { DefiStakingMapper } from '@/routes/transactions/mappers/common/defi-staking.mapper';
import {
  DefiStakingDepositConfirmationView,
  DefiStakingWithdrawConfirmationView,
} from '@/routes/transactions/entities/staking/defi-staking-confirmation-view.entity';
import { KilnNativeStakingHelper } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { KilnDefiStakingHelper } from '@/routes/transactions/helpers/kiln-defi-staking.helper';

@Injectable({})
export class TransactionsViewService {
  private readonly isNativeStakingEnabled: boolean;
  private readonly isPooledStakingEnabled: boolean;
  private readonly isDefiStakingEnabled: boolean;

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
    private readonly defiStakingHelper: KilnDefiStakingHelper,
    private readonly nativeStakingHelper: KilnNativeStakingHelper,
    private readonly pooledStakingHelper: KilnPooledStakingHelper,
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    private readonly swapAppsHelper: SwapAppsHelper,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly nativeStakingMapper: NativeStakingMapper,
    private readonly pooledStakingMapper: PooledStakingMapper,
    private readonly defiStakingMapper: DefiStakingMapper,
  ) {
    this.isNativeStakingEnabled = this.configurationService.getOrThrow<boolean>(
      'features.nativeStaking',
    );
    this.isPooledStakingEnabled = this.configurationService.getOrThrow<boolean>(
      'features.pooledStaking',
    );
    this.isDefiStakingEnabled = this.configurationService.getOrThrow<boolean>(
      'features.defiStaking',
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
        // TODO: Get Kiln to verify all deployments
        // Fallback for unverified contracts
        return {
          method: '',
          parameters: null,
        };
      });

    try {
      // Swaps
      const swapOrderData = this.swapOrderHelper.findSwapOrder(
        args.transactionDataDto.data,
      );
      if (swapOrderData) {
        return await this.getSwapOrderConfirmationView({
          chainId: args.chainId,
          data: swapOrderData,
          dataDecoded,
        });
      }

      const twapSwapOrderData = args.transactionDataDto.to
        ? this.twapOrderHelper.findTwapOrder({
            to: args.transactionDataDto.to,
            data: args.transactionDataDto.data,
          })
        : null;
      if (twapSwapOrderData) {
        return await this.getTwapOrderConfirmationView({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          data: twapSwapOrderData,
          dataDecoded,
        });
      }

      // Dedicated Staking
      const dedicatedStakingDepositData =
        this.isNativeStakingEnabled &&
        (await this.nativeStakingHelper.findDeposit({
          chainId: args.chainId,
          ...args.transactionDataDto,
        }));
      if (dedicatedStakingDepositData) {
        return await this.getNativeStakingDepositConfirmationView({
          chainId: args.chainId,
          to: dedicatedStakingDepositData.to,
          data: dedicatedStakingDepositData.data,
          dataDecoded,
        });
      }

      // Pooled staking
      const pooledStakingStakeData =
        this.isPooledStakingEnabled &&
        (await this.pooledStakingHelper.findStake({
          chainId: args.chainId,
          ...args.transactionDataDto,
        }));
      if (pooledStakingStakeData) {
        return await this.getPooledStakingDepositConfirmationView({
          chainId: args.chainId,
          to: pooledStakingStakeData.to,
          data: pooledStakingStakeData.data,
          dataDecoded,
        });
      }

      const pooledStakingRequestExitData =
        this.isPooledStakingEnabled &&
        (await this.pooledStakingHelper.findRequestExit({
          chainId: args.chainId,
          ...args.transactionDataDto,
        }));
      if (pooledStakingRequestExitData) {
        return await this.getPooledStakingRequestExitConfirmationView({
          chainId: args.chainId,
          to: pooledStakingRequestExitData.to,
          data: pooledStakingRequestExitData.data,
          dataDecoded,
        });
      }

      const pooledStakingWithdrawData =
        this.isPooledStakingEnabled &&
        (await this.pooledStakingHelper.findMultiClaim({
          chainId: args.chainId,
          ...args.transactionDataDto,
        }));
      if (pooledStakingWithdrawData) {
        return await this.getPooledStakingWithdrawConfirmationView({
          chainId: args.chainId,
          to: pooledStakingWithdrawData.to,
          data: pooledStakingWithdrawData.data,
          dataDecoded,
        });
      }

      // DeFi staking
      const defiDepositData =
        this.isDefiStakingEnabled &&
        (await this.defiStakingHelper.findDeposit({
          chainId: args.chainId,
          ...args.transactionDataDto,
        }));
      if (defiDepositData) {
        return await this.getDefiDepositConfirmationView({
          chainId: args.chainId,
          to: defiDepositData.to,
          data: defiDepositData.data,
          dataDecoded,
        });
      }

      const defiWithdrawData =
        this.isDefiStakingEnabled &&
        (await this.defiStakingHelper.findWithdraw({
          chainId: args.chainId,
          ...args.transactionDataDto,
        }));
      if (defiWithdrawData) {
        return await this.getDefiWithdrawConfirmationView({
          chainId: args.chainId,
          to: defiWithdrawData.to,
          data: defiWithdrawData.data,
          dataDecoded,
        });
      }

      throw new UnprocessableEntityException('Unable to decode data');
    } catch (error) {
      this.loggingService.warn(error);
      return new BaselineConfirmationView({
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
    }
  }

  private async getNativeStakingDepositConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<NativeStakingDepositConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (deployment.status !== 'active') {
      throw new UnprocessableEntityException(
        'Staking deployment is not active',
      );
    }

    const depositInfo = await this.nativeStakingMapper.mapDepositInfo(args);

    return new NativeStakingDepositConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      ...depositInfo,
    });
  }

  private async getPooledStakingDepositConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<PooledStakingStakeConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (deployment.status !== 'active') {
      throw new UnprocessableEntityException('Staking pool is not active');
    }

    const stakeInfo = await this.pooledStakingMapper.mapStakeInfo(args);

    return new PooledStakingStakeConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      ...stakeInfo,
    });
  }

  private async getPooledStakingRequestExitConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<PooledStakingRequestExitConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    // Don't check if active to support request exist
    if (deployment.status === 'unknown') {
      throw new NotFoundException('Staking pool not found');
    }

    const requestExitInfo =
      await this.pooledStakingMapper.mapRequestExitInfo(args);

    return new PooledStakingRequestExitConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      ...requestExitInfo,
    });
  }

  private async getPooledStakingWithdrawConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<PooledStakingWithdrawConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    // Don't check if active to support withdrawal
    if (deployment.status === 'unknown') {
      throw new NotFoundException('Staking pool not found');
    }

    const withdrawInfo = await this.pooledStakingMapper.mapWithdrawInfo(args);

    return new PooledStakingWithdrawConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      ...withdrawInfo,
    });
  }

  private async getDefiDepositConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<DefiStakingDepositConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (deployment.status !== 'active') {
      throw new UnprocessableEntityException(
        'DeFi staking vault is not active',
      );
    }

    const depositInfo = await this.defiStakingMapper.mapDepositInfo(args);

    return new DefiStakingDepositConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      ...depositInfo,
    });
  }

  private async getDefiWithdrawConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<DefiStakingWithdrawConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    // Don't check if active to support withdrawal
    if (deployment.status === 'unknown') {
      throw new NotFoundException('DeFi vault not found');
    }

    const withdrawInfo = await this.defiStakingMapper.mapWithdrawInfo(args);

    return new DefiStakingWithdrawConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      ...withdrawInfo,
    });
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
}
