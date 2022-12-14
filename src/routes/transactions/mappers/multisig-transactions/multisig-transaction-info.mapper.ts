import { Inject } from '@nestjs/common';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Operation } from '../../../../domain/safe/entities/operation.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { Token } from '../../../../domain/tokens/entities/token.entity';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { ITokenRepository } from '../../../../domain/tokens/token.repository.interface';
import { TokenType } from '../../../balances/entities/token-type.entity';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { DataDecoded } from '../../../data-decode/entities/data-decoded.entity';
import { CustomTransactionInfo } from '../../entities/custom-transaction.entity';
import { SettingsChangeTransaction } from '../../entities/settings-change-transaction.entity';
import { TransactionInfo } from '../../entities/transaction-info.entity';
import {
  TransferDirection,
  TransferTransactionInfo,
} from '../../entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '../../entities/transfers/erc20-transfer.entity';
import { Erc721Transfer } from '../../entities/transfers/erc721-transfer.entity';
import { NativeCoinTransfer } from '../../entities/transfers/native-coin-transfer.entity';
import { SettingsChangeMapper } from './settings-change.mapper';

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
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly settingsChangeMapper: SettingsChangeMapper,
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
      return await this.mapCustomTransaction(
        transaction,
        value,
        dataSize,
        chainId,
      );
    }

    if (this.isNativeCoinTransfer(value, dataSize)) {
      return this.mapNativeCoinTransfer(chainId, transaction, safe);
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
        return this.mapErc20Transfer(token, chainId, transaction);
      }

      if (token.type === TokenType.Erc721) {
        return this.mapErc721Transfer(token, chainId, transaction);
      }
    }

    return this.mapCustomTransaction(transaction, value, dataSize, chainId);
  }

  private async mapCustomTransaction(
    transaction: MultisigTransaction,
    value: number,
    dataSize: number,
    chainId: string,
  ): Promise<CustomTransactionInfo> {
    const toAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.to,
    );

    return new CustomTransactionInfo(
      this.filterAddressInfo(toAddressInfo),
      dataSize.toString(),
      value.toString(),
      transaction?.dataDecoded?.method ?? null,
      this.getActionCount(transaction),
      this.isCancellation(transaction, dataSize),
    );
  }

  private async mapNativeCoinTransfer(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<TransferTransactionInfo> {
    const recipient = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.to,
    );

    return new TransferTransactionInfo(
      { value: safe.address },
      this.filterAddressInfo(recipient),
      TransferDirection[TransferDirection.Outgoing].toUpperCase(),
      new NativeCoinTransfer(transaction.value),
    );
  }

  private async mapErc20Transfer(
    token: Token,
    chainId: string,
    transaction: MultisigTransaction,
  ): Promise<TransferTransactionInfo> {
    const { dataDecoded } = transaction;
    const sender = this.getFromParam(dataDecoded, transaction.safe);
    const recipient = this.getToParam(
      dataDecoded,
      MultisigTransactionInfoMapper.NULL_ADDRESS,
    );
    const direction = this.getTransferDirection(
      transaction.safe,
      sender,
      recipient,
    );
    const senderAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      sender,
    );
    const recipientAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      recipient,
    );

    return new TransferTransactionInfo(
      this.filterAddressInfo(senderAddressInfo),
      this.filterAddressInfo(recipientAddressInfo),
      direction,
      new Erc20Transfer(
        token.address,
        this.getValueParam(dataDecoded, '0'),
        token.name,
        token.symbol,
        token.logoUri,
        token.decimals,
      ),
    );
  }

  private async mapErc721Transfer(
    token: Token,
    chainId: string,
    transaction: MultisigTransaction,
  ): Promise<TransferTransactionInfo> {
    const { dataDecoded } = transaction;
    const sender = this.getFromParam(dataDecoded, transaction.safe);
    const recipient = this.getToParam(
      dataDecoded,
      MultisigTransactionInfoMapper.NULL_ADDRESS,
    );
    const direction = this.getTransferDirection(
      transaction.safe,
      sender,
      recipient,
    );
    const senderAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      sender,
    );
    const recipientAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      recipient,
    );

    return new TransferTransactionInfo(
      this.filterAddressInfo(senderAddressInfo),
      this.filterAddressInfo(recipientAddressInfo),
      direction,
      new Erc721Transfer(
        token.address,
        this.getValueParam(dataDecoded, '0'),
        token.name,
        token.symbol,
        token.logoUri,
      ),
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
      this.getFromParam(dataDecoded, '') === transaction.safe ||
      this.getToParam(dataDecoded, '') === transaction.safe
    );
  }

  private getFromParam(dataDecoded: DataDecoded, fallback: string): string {
    if (!dataDecoded.parameters) {
      return fallback;
    }

    switch (dataDecoded.method) {
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD:
        return typeof dataDecoded.parameters[0]?.value === 'string'
          ? dataDecoded.parameters[0]?.value
          : fallback;
      case this.TRANSFER_METHOD:
      default:
        return fallback;
    }
  }

  private getToParam(dataDecoded: DataDecoded, fallback: string): string {
    if (!dataDecoded?.parameters) {
      return fallback;
    }

    switch (dataDecoded.method) {
      case this.TRANSFER_METHOD:
        return typeof dataDecoded.parameters[0]?.value === 'string'
          ? dataDecoded.parameters[0]?.value
          : fallback;
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD:
        return typeof dataDecoded.parameters[1]?.value === 'string'
          ? dataDecoded.parameters[1]?.value
          : fallback;
      default:
        return fallback;
    }
  }

  private filterAddressInfo(addressInfo: AddressInfo): AddressInfo {
    return {
      value: addressInfo.value,
      name: addressInfo.name !== '' ? addressInfo.name : undefined,
      logoUri: addressInfo.logoUri,
    };
  }

  private getActionCount(transaction: MultisigTransaction): number | null {
    const { dataDecoded } = transaction;
    if (transaction?.dataDecoded?.method === 'multiSend') {
      const parameter = dataDecoded.parameters?.find(
        (parameter) => parameter.name === 'transactions',
      );
      return parameter?.valueDecoded?.length;
    }

    return null;
  }

  private getTransferDirection(safe: string, from: string, to: string): string {
    if (safe === from) {
      return TransferDirection[TransferDirection.Outgoing].toUpperCase();
    }
    if (safe === to) {
      return TransferDirection[TransferDirection.Incoming].toUpperCase();
    }
    return TransferDirection[TransferDirection.Unknown].toUpperCase();
  }

  private getValueParam(dataDecoded: DataDecoded, fallback: string): string {
    if (!dataDecoded.parameters) {
      return fallback;
    }

    switch (dataDecoded.method) {
      case this.TRANSFER_METHOD: {
        const value = dataDecoded.parameters[1]?.value;
        return typeof value === 'string' ? value : fallback;
      }
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD: {
        const value = dataDecoded.parameters[2]?.value;
        return typeof value === 'string' ? value : fallback;
      }
      default:
        return fallback;
    }
  }

  private isCancellation(
    transaction: MultisigTransaction,
    dataSize: number,
  ): boolean {
    const {
      to,
      safe,
      value,
      baseGas,
      gasPrice,
      gasToken,
      operation,
      refundReceiver,
      safeTxGas,
    } = transaction;

    return (
      to === safe &&
      dataSize === 0 &&
      (!value || Number(value) === 0) &&
      operation === 0 &&
      (!baseGas || Number(baseGas) === 0) &&
      (!gasPrice || Number(gasPrice) === 0) &&
      (!gasToken || gasToken === MultisigTransactionInfoMapper.NULL_ADDRESS) &&
      (!refundReceiver ||
        refundReceiver === MultisigTransactionInfoMapper.NULL_ADDRESS) &&
      (!safeTxGas || safeTxGas === 60)
    );
  }
}
