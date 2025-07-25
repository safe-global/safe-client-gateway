import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { SettingsChangeTransaction } from '@/routes/transactions/entities/settings-change-transaction.entity';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';
import { CustomTransactionMapper } from '@/routes/transactions/mappers/common/custom-transaction.mapper';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { Erc20TransferMapper } from '@/routes/transactions/mappers/common/erc20-transfer.mapper';
import { Erc721TransferMapper } from '@/routes/transactions/mappers/common/erc721-transfer.mapper';
import { HumanDescriptionMapper } from '@/routes/transactions/mappers/common/human-description.mapper';
import { NativeCoinTransferMapper } from '@/routes/transactions/mappers/common/native-coin-transfer.mapper';
import { SettingsChangeMapper } from '@/routes/transactions/mappers/common/settings-change.mapper';
import { SwapOrderMapper } from '@/routes/transactions/mappers/common/swap-order.mapper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { SwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/swap-order-info.entity';
import { SwapOrderHelper } from '@/routes/transactions/helpers/swap-order.helper';
import { TwapOrderMapper } from '@/routes/transactions/mappers/common/twap-order.mapper';
import { TwapOrderHelper } from '@/routes/transactions/helpers/twap-order.helper';
import { TwapOrderTransactionInfo } from '@/routes/transactions/entities/swaps/twap-order-info.entity';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-deposit-info.entity';
import { NativeStakingMapper } from '@/routes/transactions/mappers/common/native-staking.mapper';
import { KilnNativeStakingHelper } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { NativeStakingValidatorsExitTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-validators-exit-info.entity';
import { NativeStakingWithdrawTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-withdraw-info.entity';
import { KilnVaultHelper } from '@/routes/transactions/helpers/kiln-vault.helper';
import { VaultTransactionMapper } from '@/routes/transactions/mappers/common/vault-transaction.mapper';
import {
  VaultDepositTransactionInfo,
  VaultRedeemTransactionInfo,
} from '@/routes/transactions/entities/vaults/vault-transaction-info.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { BridgeTransactionMapper } from '@/routes/transactions/mappers/common/bridge-transaction.mapper';
import { LiFiHelper } from '@/routes/transactions/helpers/lifi-helper';
import {
  BridgeAndSwapTransactionInfo,
  SwapTransactionInfo,
} from '@/routes/transactions/entities/bridge/bridge-info.entity';
import {
  BaseDataDecoded,
  DataDecoded,
} from '@/domain/data-decoder/v2/entities/data-decoded.entity';

@Injectable()
export class MultisigTransactionInfoMapper {
  private readonly isVaultTransactionsMappingEnabled: boolean;
  private readonly isLifiTransactionsMappingEnabled: boolean;
  private readonly TRANSFER_METHOD = 'transfer';
  private readonly TRANSFER_FROM_METHOD = 'transferFrom';
  private readonly SAFE_TRANSFER_FROM_METHOD = 'safeTransferFrom';

  private readonly ERC20_TRANSFER_METHODS = [
    this.TRANSFER_METHOD,
    this.TRANSFER_FROM_METHOD,
  ];

  private readonly ERC721_TRANSFER_METHODS = [
    this.TRANSFER_METHOD,
    this.TRANSFER_FROM_METHOD,
    this.SAFE_TRANSFER_FROM_METHOD,
  ];

  constructor(
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly bridgeTransactionMapper: BridgeTransactionMapper,
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
    private readonly customTransactionMapper: CustomTransactionMapper,
    private readonly settingsChangeMapper: SettingsChangeMapper,
    private readonly liFiHelper: LiFiHelper,
    private readonly nativeCoinTransferMapper: NativeCoinTransferMapper,
    private readonly erc20TransferMapper: Erc20TransferMapper,
    private readonly erc721TransferMapper: Erc721TransferMapper,
    private readonly humanDescriptionMapper: HumanDescriptionMapper,
    private readonly swapOrderMapper: SwapOrderMapper,
    private readonly swapOrderHelper: SwapOrderHelper,
    private readonly twapOrderMapper: TwapOrderMapper,
    private readonly twapOrderHelper: TwapOrderHelper,
    private readonly kilnNativeStakingHelper: KilnNativeStakingHelper,
    private readonly kilnVaultHelper: KilnVaultHelper,
    private readonly nativeStakingMapper: NativeStakingMapper,
    private readonly vaultTransactionMapper: VaultTransactionMapper,
  ) {
    this.isVaultTransactionsMappingEnabled =
      this.configurationService.getOrThrow('features.vaultTransactionsMapping');
    this.isLifiTransactionsMappingEnabled =
      this.configurationService.getOrThrow('features.lifiTransactionsMapping');
  }

  async mapTransactionInfo(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
    dataDecoded: DataDecoded | null,
  ): Promise<TransactionInfo> {
    const value = Number(transaction?.value) || 0;
    const dataByteLength = transaction.data
      ? Buffer.byteLength(transaction.data)
      : 0;

    const dataSize =
      dataByteLength >= 2 ? Math.floor((dataByteLength - 2) / 2) : 0;

    const humanDescription =
      await this.humanDescriptionMapper.mapHumanDescription(
        transaction,
        chainId,
      );

    if (this.isLifiTransactionsMappingEnabled) {
      try {
        const swap = await this.mapSwap({
          chainId,
          transaction,
        });
        if (swap) {
          return swap;
        }

        const swapAndBridge = await this.mapSwapAndBridge({
          chainId,
          transaction,
        });
        if (swapAndBridge) {
          return swapAndBridge;
        }
      } catch (error: unknown) {
        if (error instanceof NotFoundException) {
          this.loggingService.warn(error);
        } else {
          this.loggingService.error(error);
        }
      }
    }

    const swapOrder: SwapOrderTransactionInfo | null = await this.mapSwapOrder(
      chainId,
      transaction,
    );
    // If the transaction is a swap order, we return it immediately
    if (swapOrder) return swapOrder;

    // If the transaction is a TWAP order, we return it immediately
    const twapOrder = await this.mapTwapOrder(chainId, transaction);
    if (twapOrder) {
      return twapOrder;
    }

    const nativeStakingDeposit = await this.mapNativeStakingDeposit(
      chainId,
      transaction,
    );
    // If the transaction is a native staking deposit, we return it immediately
    if (nativeStakingDeposit) {
      return nativeStakingDeposit;
    }

    const nativeStakingValidatorsExit =
      await this.mapNativeStakingValidatorsExit(chainId, transaction);
    // If the transaction is a native staking validators exit, we return it immediately
    if (nativeStakingValidatorsExit) {
      return nativeStakingValidatorsExit;
    }

    const nativeStakingWithdraw = await this.mapNativeStakingWithdraw(
      chainId,
      transaction,
    );
    // If the transaction is a native staking withdraw, we return it immediately
    if (nativeStakingWithdraw) {
      return nativeStakingWithdraw;
    }

    if (this.isVaultTransactionsMappingEnabled) {
      const vaultDeposit = await this.mapVaultDeposit({
        chainId,
        transaction,
      });
      // If the transaction is a vault deposit, we return it immediately
      if (vaultDeposit) {
        return vaultDeposit;
      }

      const vaultRedeem = await this.mapVaultRedeem({
        chainId,
        transaction,
      });
      // If the transaction is a vault redeem, we return it immediately
      if (vaultRedeem) {
        return vaultRedeem;
      }
    }

    if (this.isCustomTransaction(value, dataSize, transaction.operation)) {
      return await this.customTransactionMapper.mapCustomTransaction(
        transaction,
        dataSize,
        chainId,
        humanDescription,
        dataDecoded,
      );
    }

    if (this.isNativeCoinTransfer(value, dataSize)) {
      return this.nativeCoinTransferMapper.mapNativeCoinTransfer(
        chainId,
        transaction,
        humanDescription,
      );
    }

    if (this.isSettingsChange(transaction, value, dataSize, dataDecoded)) {
      const settingsInfo = await this.settingsChangeMapper.mapSettingsChange(
        chainId,
        dataDecoded,
      );

      if (!dataDecoded) {
        throw new Error(
          `Data decoded is null. txHash=${transaction.transactionHash}`,
        );
      }

      return new SettingsChangeTransaction(
        dataDecoded,
        settingsInfo,
        humanDescription,
      );
    }

    if (this.isValidTokenTransfer(transaction.safe, dataDecoded)) {
      const token = await this.tokenRepository
        .getToken({ chainId, address: transaction.to })
        .catch(() => null);

      switch (token?.type) {
        case 'ERC20':
          return this.erc20TransferMapper.mapErc20Transfer(
            token,
            chainId,
            transaction,
            humanDescription,
            dataDecoded,
          );
        case 'ERC721':
          return this.erc721TransferMapper.mapErc721Transfer(
            token,
            chainId,
            transaction,
            humanDescription,
            dataDecoded,
          );
      }
    }

    return this.customTransactionMapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      humanDescription,
      dataDecoded,
    );
  }

  private async mapSwap(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }): Promise<SwapTransactionInfo | null> {
    const transaction = await this.liFiHelper.getSwapTransaction(args);
    if (!transaction) {
      return null;
    }

    try {
      return await this.bridgeTransactionMapper.mapSwap({
        data: transaction.data,
        executionDate: args.transaction.executionDate,
        chainId: args.chainId,
        safeAddress: args.transaction.safe,
      });
    } catch (error) {
      this.loggingService.warn(error);
      return null;
    }
  }

  private async mapSwapAndBridge(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }): Promise<BridgeAndSwapTransactionInfo | null> {
    const transaction = await this.liFiHelper.getSwapAndBridgeTransaction(args);
    if (!transaction) {
      return null;
    }

    try {
      return this.bridgeTransactionMapper.mapSwapAndBridge({
        chainId: args.chainId,
        data: transaction.data,
        executionDate: args.transaction.executionDate,
        safeAddress: args.transaction.safe,
      });
    } catch (error) {
      this.loggingService.warn(error);
      return null;
    }
  }

  /**
   * Maps a swap order transaction.
   * If the transaction is not a swap order, it returns null.
   *
   * @param chainId
   * @param transaction
   * @private
   */
  private async mapSwapOrder(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
  ): Promise<SwapOrderTransactionInfo | null> {
    if (!transaction?.data) {
      return null;
    }

    const orderData: `0x${string}` | null = this.swapOrderHelper.findSwapOrder(
      transaction.data,
    );

    if (!orderData) {
      return null;
    }

    try {
      return await this.swapOrderMapper.mapSwapOrder(chainId, {
        data: orderData,
      });
    } catch (error) {
      // The transaction is a swap order, but we couldn't decode it successfully.
      this.loggingService.warn(error);
      return null;
    }
  }

  /**
   * Maps a TWAP order transaction.
   * If the transaction is not a TWAP order, it returns null.
   *
   * @param chainId - chain ID of the transaction
   * @param transaction - transaction to map
   * @returns mapped {@link TwapOrderTransactionInfo} or null if none found
   */
  private async mapTwapOrder(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
  ): Promise<TwapOrderTransactionInfo | null> {
    if (!transaction?.data) {
      return null;
    }

    const orderData = this.twapOrderHelper.findTwapOrder({
      to: transaction.to,
      data: transaction.data,
    });

    if (!orderData) {
      return null;
    }

    try {
      return await this.twapOrderMapper.mapTwapOrder(
        chainId,
        transaction.safe,
        {
          data: orderData,
          executionDate: transaction.executionDate,
        },
      );
    } catch (error) {
      this.loggingService.warn(error);
      return null;
    }
  }

  /**
   * Maps a native staking `deposit` transaction.
   * If the transaction is not to an official deployment, it returns null.
   *
   * @param chainId - chain ID of the transaction
   * @param transaction - transaction to map
   * @returns mapped {@link NativeStakingDepositTransactionInfo} or null if none found
   */
  private async mapNativeStakingDeposit(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
  ): Promise<NativeStakingDepositTransactionInfo | null> {
    if (!transaction?.data || !transaction.value) {
      return null;
    }

    const nativeStakingDepositTransaction =
      this.kilnNativeStakingHelper.findDepositTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
      });

    if (!nativeStakingDepositTransaction?.to) {
      return null;
    }

    try {
      return await this.nativeStakingMapper.mapDepositInfo({
        chainId,
        to: nativeStakingDepositTransaction.to,
        value: nativeStakingDepositTransaction.value,
        txHash: transaction.transactionHash,
      });
    } catch (error) {
      this.loggingService.warn(error);
      return null;
    }
  }

  private async mapNativeStakingValidatorsExit(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
  ): Promise<NativeStakingValidatorsExitTransactionInfo | null> {
    if (!transaction?.data || !transaction.value) {
      return null;
    }

    const nativeStakingValidatorsExitTransaction =
      this.kilnNativeStakingHelper.findValidatorsExitTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
      });

    if (!nativeStakingValidatorsExitTransaction?.to) {
      return null;
    }

    try {
      return await this.nativeStakingMapper.mapValidatorsExitInfo({
        chainId,
        safeAddress: transaction.safe,
        to: nativeStakingValidatorsExitTransaction.to,
        data: nativeStakingValidatorsExitTransaction.data,
      });
    } catch (error) {
      this.loggingService.warn(error);
      return null;
    }
  }

  private async mapVaultDeposit(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }): Promise<VaultDepositTransactionInfo | null> {
    if (!args.transaction?.data || !args.transaction.value) {
      return null;
    }

    const vaultDepositTransaction =
      this.kilnVaultHelper.getVaultDepositTransaction({
        to: args.transaction.to,
        data: args.transaction.data,
        value: args.transaction.value,
      });

    if (!vaultDepositTransaction?.to) {
      return null;
    }

    try {
      return await this.vaultTransactionMapper.mapDepositInfo({
        chainId: args.chainId,
        to: vaultDepositTransaction.to,
        assets: vaultDepositTransaction.assets,
        data: vaultDepositTransaction.data,
        safeAddress: args.transaction.safe,
      });
    } catch (error) {
      this.loggingService.warn(error);
      return null;
    }
  }

  private async mapVaultRedeem(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }): Promise<VaultRedeemTransactionInfo | null> {
    if (!args.transaction?.data || !args.transaction.value) {
      return null;
    }

    const vaultRedeemOrWithdrawTransaction =
      this.kilnVaultHelper.getVaultRedeemOrWithdrawTransaction({
        to: args.transaction.to,
        data: args.transaction.data,
        value: args.transaction.value,
      });

    if (!vaultRedeemOrWithdrawTransaction?.to) {
      return null;
    }

    try {
      return await this.vaultTransactionMapper.mapRedeemInfo({
        chainId: args.chainId,
        to: vaultRedeemOrWithdrawTransaction.to,
        assets: vaultRedeemOrWithdrawTransaction.assets,
        data: vaultRedeemOrWithdrawTransaction.data,
        safeAddress: args.transaction.safe,
      });
    } catch (error) {
      this.loggingService.warn(error);
      return null;
    }
  }

  private async mapNativeStakingWithdraw(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
  ): Promise<NativeStakingWithdrawTransactionInfo | null> {
    if (!transaction?.data || !transaction.value) {
      return null;
    }

    const nativeStakingWithdrawTransaction =
      this.kilnNativeStakingHelper.findWithdrawTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
      });

    if (!nativeStakingWithdrawTransaction?.to) {
      return null;
    }

    try {
      return await this.nativeStakingMapper.mapWithdrawInfo({
        chainId,
        safeAddress: transaction.safe,
        to: nativeStakingWithdrawTransaction.to,
        txHash: transaction.transactionHash,
        data: nativeStakingWithdrawTransaction.data,
      });
    } catch (error) {
      this.loggingService.warn(error);
      return null;
    }
  }

  private isCustomTransaction(
    value: number,
    dataSize: number,
    operation: Operation,
  ): boolean {
    return (value > 0 && dataSize > 0) || operation !== Operation.CALL;
  }

  private isNativeCoinTransfer(value: number, dataSize: number): boolean {
    return value > 0 && dataSize === 0;
  }

  private isSettingsChange(
    transaction: MultisigTransaction | ModuleTransaction,
    value: number,
    dataSize: number,
    dataDecoded: DataDecoded | null,
  ): boolean {
    const isSettingsChangeMethod: boolean = dataDecoded
      ? SettingsChangeMapper.SETTINGS_CHANGE_METHODS.includes(
          dataDecoded.method,
        )
      : false;

    return (
      value === 0 &&
      dataSize > 0 &&
      transaction.safe === transaction.to &&
      isSettingsChangeMethod
    );
  }

  public isValidTokenTransfer(
    safeAddress: `0x${string}`,
    dataDecoded: BaseDataDecoded | null,
  ): boolean {
    return (
      (this.isErc20Transfer(dataDecoded) ||
        this.isErc721Transfer(dataDecoded)) &&
      this.isSafeSenderOrReceiver(safeAddress, dataDecoded)
    );
  }

  private isErc20Transfer(dataDecoded: BaseDataDecoded | null): boolean {
    return this.ERC20_TRANSFER_METHODS.some(
      (method) => method === dataDecoded?.method,
    );
  }

  private isErc721Transfer(dataDecoded: BaseDataDecoded | null): boolean {
    return this.ERC721_TRANSFER_METHODS.some(
      (method) => method === dataDecoded?.method,
    );
  }

  private isSafeSenderOrReceiver(
    safeAddress: `0x${string}`,
    dataDecoded: BaseDataDecoded | null,
  ): boolean {
    if (!dataDecoded) return false;
    return (
      this.TRANSFER_METHOD == dataDecoded.method ||
      this.dataDecodedParamHelper.getFromParam(dataDecoded, '') ===
        safeAddress ||
      this.dataDecodedParamHelper.getToParam(dataDecoded, '') === safeAddress
    );
  }
}
