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
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { KilnDedicatedStakingHelper } from '@/routes/transactions/helpers/kiln-dedicated-staking.helper';
import {
  DedicatedDepositConfirmationView,
  PooledDepositConfirmationView,
  PooledRequestExitConfirmationView,
  PooledMultiClaimConfirmationView,
  DefiDepositConfirmationView,
  DefiWithdrawConfirmationView,
} from '@/routes/transactions/entities/confirmation-view/staking-confirmation-view.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { KilnDefiVaultHelper } from '@/routes/transactions/helpers/kiln-defi-vault.helper';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable({})
export class TransactionsViewService {
  isDedicatedStakingEnabled: boolean;
  isPooledStakingEnabled: boolean;
  isDefiVaultsEnabled: boolean;

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
    private readonly defiVaultHelper: KilnDefiVaultHelper,
    private readonly dedicatedStakingHelper: KilnDedicatedStakingHelper,
    private readonly pooledStakingHelper: KilnPooledStakingHelper,
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    private readonly swapAppsHelper: SwapAppsHelper,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isDedicatedStakingEnabled =
      this.configurationService.getOrThrow<boolean>(
        'features.dedicatedStaking',
      );
    this.isPooledStakingEnabled = this.configurationService.getOrThrow<boolean>(
      'features.pooledStaking',
    );
    this.isDefiVaultsEnabled = this.configurationService.getOrThrow<boolean>(
      'features.defiVaults',
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
        this.isDedicatedStakingEnabled &&
        (await this.dedicatedStakingHelper.findDeposit({
          chainId: args.chainId,
          ...args.transactionDataDto,
        }));
      if (dedicatedStakingDepositData) {
        return await this.getDedicatedStakingDepositConfirmationView({
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
        return await this.getPooledStakingStakeConfirmationView({
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

      // DeFi vault
      const defiDepositData =
        this.isDefiVaultsEnabled &&
        (await this.defiVaultHelper.findDeposit({
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
        this.isDefiVaultsEnabled &&
        (await this.defiVaultHelper.findWithdraw({
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

  private async getDedicatedStakingDepositConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<DedicatedDepositConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (
      deployment.product_type !== 'dedicated' ||
      deployment.chain === 'unknown'
    ) {
      throw new NotFoundException('Staking deployment not found');
    }

    if (deployment.status !== 'active' || !deployment.product_fee) {
      throw new UnprocessableEntityException(
        'Staking deployment is not active',
      );
    }

    const [dedicatedStakingStats, networkStats] = await Promise.all([
      this.stakingRepository.getDedicatedStakingStats(args.chainId),
      this.stakingRepository.getNetworkStats(args.chainId),
    ]);

    const fee = Number(deployment.product_fee);
    const nrr = dedicatedStakingStats.gross_apy.last_30d * (1 - fee);

    return new DedicatedDepositConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      estimatedEntryTime: networkStats.estimated_entry_time_seconds,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      fee,
      monthlyNrr: nrr,
      annualNrr: nrr,
    });
  }

  private async getPooledStakingStakeConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<PooledDepositConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (
      deployment.product_type !== 'pooling' ||
      deployment.chain === 'unknown'
    ) {
      throw new NotFoundException('Staking pool not found');
    }

    if (deployment.status !== 'active') {
      throw new UnprocessableEntityException('Staking pool is not active');
    }

    const [pooledStakingStats, networkStats, poolToken, exchangeRate] =
      await Promise.all([
        this.stakingRepository.getPooledStakingStats({
          chainId: args.chainId,
          pool: args.to,
        }),
        this.stakingRepository.getNetworkStats(args.chainId),
        this.pooledStakingHelper.getPoolToken({
          chainId: args.chainId,
          pool: args.to,
        }),
        this.pooledStakingHelper.getRate({
          chainId: args.chainId,
          pool: args.to,
        }),
      ]);

    return new PooledDepositConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      estimatedEntryTime: networkStats.estimated_entry_time_seconds,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      fee: pooledStakingStats.fee,
      monthlyNrr: pooledStakingStats.one_month.nrr,
      annualNrr: pooledStakingStats.one_year.nrr,
      pool: new AddressInfo(args.to, deployment.display_name),
      exchangeRate: exchangeRate.toString(),
      poolToken,
    });
  }

  private async getPooledStakingRequestExitConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<PooledRequestExitConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (
      deployment.product_type !== 'pooling' ||
      deployment.chain === 'unknown' ||
      // Don't check if active to support request exist
      deployment.status === 'unknown'
    ) {
      throw new NotFoundException('Staking pool not found');
    }

    const [networkStats, poolToken, exchangeRate] = await Promise.all([
      this.stakingRepository.getNetworkStats(args.chainId),
      this.pooledStakingHelper.getPoolToken({
        chainId: args.chainId,
        pool: args.to,
      }),
      this.pooledStakingHelper.getRate({
        chainId: args.chainId,
        pool: args.to,
      }),
    ]);

    return new PooledRequestExitConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      estimatedEntryTime: networkStats.estimated_entry_time_seconds,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      pool: new AddressInfo(args.to, deployment.display_name),
      exchangeRate: exchangeRate.toString(),
      poolToken,
    });
  }

  private async getPooledStakingWithdrawConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<PooledMultiClaimConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (
      deployment.product_type !== 'pooling' ||
      deployment.chain === 'unknown' ||
      // Don't check if active to support withdrawal
      deployment.status === 'unknown'
    ) {
      throw new NotFoundException('Staking pool not found');
    }

    const [networkStats, poolToken, exchangeRate] = await Promise.all([
      this.stakingRepository.getNetworkStats(args.chainId),
      this.pooledStakingHelper.getPoolToken({
        chainId: args.chainId,
        pool: args.to,
      }),
      this.pooledStakingHelper.getRate({
        chainId: args.chainId,
        pool: args.to,
      }),
    ]);

    return new PooledMultiClaimConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      estimatedEntryTime: networkStats.estimated_entry_time_seconds,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      pool: new AddressInfo(args.to, deployment.display_name),
      exchangeRate: exchangeRate.toString(),
      poolToken,
    });
  }

  private async getDefiDepositConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<DefiDepositConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (deployment.product_type !== 'defi' || deployment.chain === 'unknown') {
      throw new NotFoundException('DeFi vault not found');
    }

    if (deployment.status !== 'active') {
      throw new UnprocessableEntityException('DeFi vault is not active');
    }

    const defiVaultStats = await this.stakingRepository.getDefiVaultStats({
      chainId: args.chainId,
      vault: args.to,
    });

    if (
      defiVaultStats.protocol === 'unknown' ||
      defiVaultStats.chain === 'unknown'
    ) {
      throw new NotFoundException('DeFi vault stats not found');
    }

    const [amount] = this.defiVaultHelper.decodeDeposit(args.data);
    const [exchangeRate, vaultToken] = await Promise.all([
      this.defiVaultHelper.previewDeposit({
        chainId: args.chainId,
        vault: args.to,
        amount,
      }),
      this.tokenRepository.getToken({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);

    return new DefiDepositConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      fee: 0, // TODO
      monthlyNrr: defiVaultStats.nrr,
      annualNrr: defiVaultStats.nrr,
      vault: new AddressInfo(args.to, deployment.display_name),
      exchangeRate: exchangeRate.toString(),
      vaultToken: new TokenInfo({
        address: vaultToken.address,
        decimals: vaultToken.decimals ?? defiVaultStats.asset_decimals,
        logoUri: vaultToken.logoUri,
        name: vaultToken.name,
        symbol: vaultToken.symbol,
        trusted: vaultToken.trusted,
      }),
    });
  }

  private async getDefiWithdrawConfirmationView(args: {
    chainId: string;
    to: `0x${string}`;
    data: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<DefiWithdrawConfirmationView> {
    const deployment = await this.stakingRepository.getDeployment({
      chainId: args.chainId,
      address: args.to,
    });

    if (
      deployment.product_type !== 'defi' ||
      deployment.chain === 'unknown' ||
      // Don't check if active to support withdrawal
      deployment.status === 'unknown'
    ) {
      throw new NotFoundException('DeFi vault not found');
    }

    const defiVaultStats = await this.stakingRepository.getDefiVaultStats({
      chainId: args.chainId,
      vault: args.to,
    });

    if (
      defiVaultStats.protocol === 'unknown' ||
      defiVaultStats.chain === 'unknown'
    ) {
      throw new NotFoundException('DeFi vault stats not found');
    }

    const [amount] = this.defiVaultHelper.decodeWithdraw(args.data);
    const [exchangeRate, vaultToken] = await Promise.all([
      this.defiVaultHelper.previewWithdraw({
        chainId: args.chainId,
        vault: args.to,
        amount,
      }),
      this.tokenRepository.getToken({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);

    return new DefiWithdrawConfirmationView({
      method: args.dataDecoded.method,
      parameters: args.dataDecoded.parameters,
      vault: new AddressInfo(args.to, deployment.display_name),
      exchangeRate: exchangeRate.toString(),
      vaultToken: new TokenInfo({
        address: vaultToken.address,
        decimals: vaultToken.decimals ?? defiVaultStats.asset_decimals,
        logoUri: vaultToken.logoUri,
        name: vaultToken.name,
        symbol: vaultToken.symbol,
        trusted: vaultToken.trusted,
      }),
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
