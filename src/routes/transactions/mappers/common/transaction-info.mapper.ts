import { Inject, Injectable } from '@nestjs/common';
import { ModuleTransaction } from '../../../../domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Operation } from '../../../../domain/safe/entities/operation.entity';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { ITokenRepository } from '../../../../domain/tokens/token.repository.interface';
import { TokenType } from '../../../balances/entities/token-type.entity';
import { SettingsChangeTransaction } from '../../entities/settings-change-transaction.entity';
import { TransactionInfo } from '../../entities/transaction-info.entity';
import { CustomTransactionMapper } from './custom-transaction.mapper';
import { DataDecodedParamHelper } from './data-decoded-param.helper';
import { Erc20TransferMapper } from './erc20-transfer.mapper';
import { Erc721TransferMapper } from './erc721-transfer.mapper';
import { NativeCoinTransferMapper } from './native-coin-transfer.mapper';
import { SettingsChangeMapper } from './settings-change.mapper';
import { DataDecoded } from '../../../data-decode/entities/data-decoded.entity';
import { DataDecodedParameter } from '../../../data-decode/entities/data-decoded-parameter.entity';
import { HumanDescriptionMapper } from '../common/human-description.mapper';
import { SafeAppInfoMapper } from '../common/safe-app-info.mapper';
import { isMultisigTransaction } from '../../../../domain/safe/entities/transaction.entity';
import { IConfigurationService } from '../../../../config/configuration.service.interface';

@Injectable()
export class MultisigTransactionInfoMapper {
  private readonly TRANSFER_METHOD = 'transfer';
  private readonly TRANSFER_FROM_METHOD = 'transferFrom';
  private readonly SAFE_TRANSFER_FROM_METHOD = 'safeTransferFrom';
  private readonly HUMAN_DESCRIPTION_ENABLED: boolean | undefined;

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
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
    private readonly customTransactionMapper: CustomTransactionMapper,
    private readonly settingsChangeMapper: SettingsChangeMapper,
    private readonly nativeCoinTransferMapper: NativeCoinTransferMapper,
    private readonly erc20TransferMapper: Erc20TransferMapper,
    private readonly erc721TransferMapper: Erc721TransferMapper,
    private readonly humanDescriptionMapper: HumanDescriptionMapper,
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
  ) {
    this.HUMAN_DESCRIPTION_ENABLED = this.configurationService.get(
      'features.humanDescription',
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

    const safeAppInfo = isMultisigTransaction(transaction)
      ? await this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction)
      : null;

    const humanDescription = this.HUMAN_DESCRIPTION_ENABLED
      ? await this.humanDescriptionMapper.mapHumanDescription(
          transaction.to,
          transaction.data,
          chainId,
          safeAppInfo,
        )
      : null;

    if (this.isCustomTransaction(value, dataSize, transaction.operation)) {
      return await this.customTransactionMapper.mapCustomTransaction(
        transaction,
        dataSize,
        chainId,
        humanDescription,
      );
    }

    if (this.isNativeCoinTransfer(value, dataSize)) {
      return this.nativeCoinTransferMapper.mapNativeCoinTransfer(
        chainId,
        transaction,
        humanDescription,
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
          );
        case TokenType.Erc721:
          return this.erc721TransferMapper.mapErc721Transfer(
            token,
            chainId,
            transaction,
            humanDescription,
          );
      }
    }

    return this.customTransactionMapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      humanDescription,
    );
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
