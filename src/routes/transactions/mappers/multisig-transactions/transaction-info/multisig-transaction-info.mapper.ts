import { Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../../../domain/safe/entities/multisig-transaction.entity';
import { Operation } from '../../../../../domain/safe/entities/operation.entity';
import { Safe } from '../../../../../domain/safe/entities/safe.entity';
import { TokenRepository } from '../../../../../domain/tokens/token.repository';
import { ITokenRepository } from '../../../../../domain/tokens/token.repository.interface';
import { TokenType } from '../../../../balances/entities/token-type.entity';
import { SettingsChangeTransaction } from '../../../entities/settings-change-transaction.entity';
import { TransactionInfo } from '../../../entities/transaction-info.entity';
import { CustomTransactionMapper } from './custom-transaction.mapper';
import { DataDecodedParamHelper } from './data-decoded-param.helper';
import { Erc20TransferMapper } from './erc20-transfer.mapper';
import { Erc721TransferMapper } from './erc721-transfer.mapper';
import { NativeCoinTransferMapper } from './native-coin-transfer.mapper';
import { SettingsChangeMapper } from './settings-change.mapper';

@Injectable()
export class MultisigTransactionInfoMapper {
  private static readonly NULL_ADDRESS =
    '0x0000000000000000000000000000000000000000';

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
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
    private readonly customTransactionMapper: CustomTransactionMapper,
    private readonly settingsChangeMapper: SettingsChangeMapper,
    private readonly nativeCoinTransferMapper: NativeCoinTransferMapper,
    private readonly erc20TransferMapper: Erc20TransferMapper,
    private readonly erc721TransferMapper: Erc721TransferMapper,
  ) {}

  async mapTransactionInfo(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<TransactionInfo> {
    const value = Number(transaction?.value) || 0;
    const dataByteLength = transaction.data
      ? Buffer.byteLength(transaction.data)
      : 0;

    const dataSize = dataByteLength >= 2 ? (dataByteLength - 2) / 2 : 0;

    if (this.isCustomTransaction(value, dataSize, transaction.operation)) {
      return await this.customTransactionMapper.mapCustomTransaction(
        transaction,
        value,
        dataSize,
        chainId,
      );
    }

    if (this.isNativeCoinTransfer(value, dataSize)) {
      return this.nativeCoinTransferMapper.mapNativeCoinTransfer(
        chainId,
        transaction,
        safe,
      );
    }

    if (this.isSettingsChange(transaction, value, dataSize)) {
      const settingsInfo = await this.settingsChangeMapper.mapSettingsChange(
        chainId,
        transaction,
        safe,
      );
      return new SettingsChangeTransaction(
        transaction.dataDecoded,
        settingsInfo,
      );
    }

    if (this.isValidTokenTransfer(transaction)) {
      const token = await this.tokenRepository.getToken(
        chainId,
        transaction.to,
      );

      if (token.type === TokenType.Erc20) {
        return this.erc20TransferMapper.mapErc20Transfer(
          token,
          chainId,
          transaction,
        );
      }

      if (token.type === TokenType.Erc721) {
        return this.erc721TransferMapper.mapErc721Transfer(
          token,
          chainId,
          transaction,
        );
      }
    }

    return this.customTransactionMapper.mapCustomTransaction(
      transaction,
      value,
      dataSize,
      chainId,
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
    transaction: MultisigTransaction,
    value: number,
    dataSize: number,
  ): boolean {
    return (
      value === 0 &&
      dataSize > 0 &&
      transaction.safe === transaction.to &&
      SettingsChangeMapper.SETTINGS_CHANGE_METHODS.includes(
        transaction.dataDecoded?.method,
      )
    );
  }

  private isValidTokenTransfer(transaction: MultisigTransaction): boolean {
    return (
      (this.isErc20Transfer(transaction) ||
        this.isErc721Transfer(transaction)) &&
      this.isSafeSenderOrReceiver(transaction)
    );
  }

  private isErc20Transfer(transaction: MultisigTransaction): boolean {
    const { dataDecoded } = transaction;
    return this.ERC20_TRANSFER_METHODS.some(
      (method) => method === dataDecoded?.method,
    );
  }

  private isErc721Transfer(transaction: MultisigTransaction): boolean {
    const { dataDecoded } = transaction;
    return this.ERC721_TRANSFER_METHODS.some(
      (method) => method === dataDecoded?.method,
    );
  }

  private isSafeSenderOrReceiver(transaction: MultisigTransaction): boolean {
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
