import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenType } from '@/routes/balances/entities/token-type.entity';
import { DataDecodedParameter } from '@/routes/data-decode/entities/data-decoded-parameter.entity';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { SettingsChangeTransaction } from '@/routes/transactions/entities/settings-change-transaction.entity';
import { TransactionInfo } from '@/routes/transactions/entities/transaction-info.entity';
import { CustomTransactionMapper } from '@/routes/transactions/mappers/common/custom-transaction.mapper';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { Erc20TransferMapper } from '@/routes/transactions/mappers/common/erc20-transfer.mapper';
import { Erc721TransferMapper } from '@/routes/transactions/mappers/common/erc721-transfer.mapper';
import { HumanDescriptionMapper } from '@/routes/transactions/mappers/common/human-description.mapper';
import { NativeCoinTransferMapper } from '@/routes/transactions/mappers/common/native-coin-transfer.mapper';
import { SettingsChangeMapper } from '@/routes/transactions/mappers/common/settings-change.mapper';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import { SwapOrderMapper } from '@/routes/transactions/mappers/common/swap-order.mapper';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { isHex } from 'viem';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { SwapOrderTransactionInfo } from '@/routes/transactions/entities/swap-order-info.entity';

@Injectable()
export class MultisigTransactionInfoMapper {
  private readonly TRANSFER_METHOD = 'transfer';
  private readonly TRANSFER_FROM_METHOD = 'transferFrom';
  private readonly SAFE_TRANSFER_FROM_METHOD = 'safeTransferFrom';
  private readonly isRichFragmentsEnabled: boolean;
  private readonly isSwapsDecodingEnabled: boolean;

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
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
    private readonly customTransactionMapper: CustomTransactionMapper,
    private readonly settingsChangeMapper: SettingsChangeMapper,
    private readonly nativeCoinTransferMapper: NativeCoinTransferMapper,
    private readonly erc20TransferMapper: Erc20TransferMapper,
    private readonly erc721TransferMapper: Erc721TransferMapper,
    private readonly humanDescriptionMapper: HumanDescriptionMapper,
    private readonly setPreSignatureDecoder: SetPreSignatureDecoder,
    private readonly swapOrderMapper: SwapOrderMapper,
    private readonly multiSendDecoder: MultiSendDecoder,
  ) {
    this.isRichFragmentsEnabled = this.configurationService.getOrThrow(
      'features.richFragments',
    );
    this.isSwapsDecodingEnabled = this.configurationService.getOrThrow(
      'features.swapsDecoding',
    );
  }

  async mapTransactionInfo(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
  ): Promise<TransactionInfo> {
    const value = Number(transaction?.value) || 0;
    const dataByteLength = transaction.data
      ? Buffer.byteLength(transaction.data)
      : 0;

    const dataSize =
      dataByteLength >= 2 ? Math.floor((dataByteLength - 2) / 2) : 0;

    const richDecodedInfo =
      await this.humanDescriptionMapper.mapRichDecodedInfo(
        transaction,
        chainId,
      );

    const humanDescription =
      this.humanDescriptionMapper.mapHumanDescription(richDecodedInfo);

    // If the rich fragment feature is disabled, we set it as undefined.
    // Undefined properties are not rendered on the response
    const richDecodedInfoApiProperty = this.isRichFragmentsEnabled
      ? richDecodedInfo
      : undefined;

    if (this.isSwapsDecodingEnabled) {
      const swapOrder: SwapOrderTransactionInfo | null =
        await this.mapSwapOrder(chainId, transaction);
      // If the transaction is a swap order, we return it immediately
      if (swapOrder) return swapOrder;
    }

    if (this.isCustomTransaction(value, dataSize, transaction.operation)) {
      return await this.customTransactionMapper.mapCustomTransaction(
        transaction,
        dataSize,
        chainId,
        humanDescription,
        richDecodedInfoApiProperty,
      );
    }

    if (this.isNativeCoinTransfer(value, dataSize)) {
      return this.nativeCoinTransferMapper.mapNativeCoinTransfer(
        chainId,
        transaction,
        humanDescription,
        richDecodedInfoApiProperty,
      );
    }

    if (this.isSettingsChange(transaction, value, dataSize)) {
      const settingsInfo = await this.settingsChangeMapper.mapSettingsChange(
        chainId,
        transaction,
      );

      if (!transaction.dataDecoded) {
        throw new Error(
          `Data decoded is null. txHash=${transaction.transactionHash}`,
        );
      }

      const dataDecodedParameters: DataDecodedParameter[] | null =
        transaction.dataDecoded.parameters?.map(
          (parameter) =>
            new DataDecodedParameter(
              parameter.name,
              parameter.type,
              parameter.value,
              parameter.valueDecoded,
            ),
        ) ?? null;

      return new SettingsChangeTransaction(
        new DataDecoded(transaction.dataDecoded.method, dataDecodedParameters),
        settingsInfo,
        humanDescription,
        richDecodedInfoApiProperty,
      );
    }

    if (this.isValidTokenTransfer(transaction)) {
      const token = await this.tokenRepository
        .getToken({ chainId, address: transaction.to })
        .catch(() => null);

      switch (token?.type) {
        case TokenType.Erc20:
          return this.erc20TransferMapper.mapErc20Transfer(
            token,
            chainId,
            transaction,
            humanDescription,
            richDecodedInfoApiProperty,
          );
        case TokenType.Erc721:
          return this.erc721TransferMapper.mapErc721Transfer(
            token,
            chainId,
            transaction,
            humanDescription,
            richDecodedInfoApiProperty,
          );
      }
    }

    return this.customTransactionMapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      humanDescription,
      richDecodedInfoApiProperty,
    );
  }

  private isSwapOrder(transaction: { data?: `0x${string}` }): boolean {
    if (!transaction.data) return false;
    return this.setPreSignatureDecoder.isSetPreSignature(transaction.data);
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
    if (!transaction?.data || !isHex(transaction.data)) {
      return null;
    }

    const orderData: `0x${string}` | null = this.findSwapOrder(
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
   * Finds the swap order in the transaction data.
   * The swap order can be in the transaction data directly or in the data of a Multisend transaction.
   *
   * @param data - The transaction data
   * @private
   * @returns The swap order if found, otherwise null
   */
  private findSwapOrder(data: `0x${string}`): `0x${string}` | null {
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

  private isCustomTransaction(
    value: number,
    dataSize: number,
    operation: Operation,
  ): boolean {
    return (value > 0 && dataSize > 0) || operation !== 0;
  }

  private isNativeCoinTransfer(value: number, dataSize: number): boolean {
    return value > 0 && dataSize === 0;
  }

  private isSettingsChange(
    transaction: MultisigTransaction | ModuleTransaction,
    value: number,
    dataSize: number,
  ): boolean {
    const isSettingsChangeMethod: boolean = transaction.dataDecoded
      ? SettingsChangeMapper.SETTINGS_CHANGE_METHODS.includes(
          transaction.dataDecoded.method,
        )
      : false;

    return (
      value === 0 &&
      dataSize > 0 &&
      transaction.safe === transaction.to &&
      isSettingsChangeMethod
    );
  }

  private isValidTokenTransfer(
    transaction: MultisigTransaction | ModuleTransaction,
  ): boolean {
    return (
      (this.isErc20Transfer(transaction) ||
        this.isErc721Transfer(transaction)) &&
      this.isSafeSenderOrReceiver(transaction)
    );
  }

  private isErc20Transfer(
    transaction: MultisigTransaction | ModuleTransaction,
  ): boolean {
    const { dataDecoded } = transaction;
    return this.ERC20_TRANSFER_METHODS.some(
      (method) => method === dataDecoded?.method,
    );
  }

  private isErc721Transfer(
    transaction: MultisigTransaction | ModuleTransaction,
  ): boolean {
    const { dataDecoded } = transaction;
    return this.ERC721_TRANSFER_METHODS.some(
      (method) => method === dataDecoded?.method,
    );
  }

  private isSafeSenderOrReceiver(
    transaction: MultisigTransaction | ModuleTransaction,
  ): boolean {
    const { dataDecoded } = transaction;
    if (!dataDecoded) return false;
    return (
      this.TRANSFER_METHOD == dataDecoded.method ||
      this.dataDecodedParamHelper.getFromParam(dataDecoded, '') ===
        transaction.safe ||
      this.dataDecodedParamHelper.getToParam(dataDecoded, '') ===
        transaction.safe
    );
  }
}
