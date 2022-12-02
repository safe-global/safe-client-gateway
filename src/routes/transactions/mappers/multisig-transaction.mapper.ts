import { Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../domain/safe/entities/multisig-transaction.entity';
import { Operation } from '../../../domain/safe/entities/operation.entity';
import { Safe } from '../../../domain/safe/entities/safe.entity';
import { Token } from '../../../domain/tokens/entities/token.entity';
import { TokenRepository } from '../../../domain/tokens/token.repository';
import { ITokenRepository } from '../../../domain/tokens/token.repository.interface';
import { TokenType } from '../../balances/entities/token-type.entity';
import { AddressInfoHelper } from '../../common/address-info/address-info.helper';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { DataDecoded } from '../../data-decode/entities/data-decoded.entity';
import { CustomTransactionInfo } from '../entities/custom-transaction.entity';
import {
  ExecutionInfo,
  TransactionInfo,
  TransactionSummary,
} from '../entities/multisig-transaction.entity';
import {
  AddOwner,
  ChangeImplementation,
  ChangeThreshold,
  DeleteGuard,
  DisableModule,
  EnableModule,
  RemoveOwner,
  SetFallbackHandler,
  SetGuard,
  SettingsChangeTransactionInfo,
  SettingsInfo,
  SwapOwner,
} from '../entities/settings-change-transaction.entity';
import {
  Erc20TransferInfo,
  Erc721TransferInfo,
  NativeCoinTransferInfo,
  TransferDirection,
  TransferTransaction,
} from '../entities/transfer-transaction.entity';

@Injectable()
export class MultisigTransactionMapper {
  private readonly NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

  private readonly SET_FALLBACK_HANDLER = 'setFallbackHandler';
  private readonly ADD_OWNER_WITH_THRESHOLD = 'addOwnerWithThreshold';
  private readonly REMOVE_OWNER = 'removeOwner';
  private readonly SWAP_OWNER = 'swapOwner';
  private readonly CHANGE_THRESHOLD = 'changeThreshold';
  private readonly CHANGE_MASTER_COPY = 'changeMasterCopy';
  private readonly ENABLE_MODULE = 'enableModule';
  private readonly DISABLE_MODULE = 'disableModule';
  private readonly SET_GUARD = 'setGuard';

  private readonly SETTINGS_CHANGE_METHODS = [
    this.SET_FALLBACK_HANDLER,
    this.ADD_OWNER_WITH_THRESHOLD,
    this.REMOVE_OWNER,
    this.SWAP_OWNER,
    this.CHANGE_THRESHOLD,
    this.CHANGE_MASTER_COPY,
    this.ENABLE_MODULE,
    this.DISABLE_MODULE,
    this.SET_GUARD,
  ];

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
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
  ) {}

  async mapToTransactionSummary(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<TransactionSummary> {
    const txStatus = this.mapTxStatus(transaction, safe);
    const txInfo = await this.mapTransactionInfo(chainId, transaction, safe);

    return {
      id: `multisig_${transaction.safe}_${transaction.safeTxHash}`,
      timestamp:
        transaction?.executionDate?.getTime() ??
        transaction?.submissionDate?.getTime(),
      txStatus,
      txInfo,
      executionInfo: this.mapExecutionInfo(transaction, safe, txStatus),
    };
  }

  private async mapSettingsInfo(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<SettingsInfo | undefined> {
    const { dataDecoded } = transaction;
    switch (dataDecoded.method) {
      case this.SET_FALLBACK_HANDLER:
        return <SetFallbackHandler>{
          type: 'SET_FALLBACK_HANDLER',
          handler: dataDecoded.parameters[0]?.value,
        };
      case this.ADD_OWNER_WITH_THRESHOLD:
        return <AddOwner>{
          type: 'ADD_OWNER',
          owner: { value: dataDecoded.parameters[0]?.value },
          threshold: Number(dataDecoded.parameters[1]?.value),
        };
      case this.REMOVE_OWNER:
        return <RemoveOwner>{
          type: 'REMOVE_OWNER',
          owner: { value: dataDecoded.parameters[1]?.value },
          threshold: Number(dataDecoded.parameters[2]?.value),
        };
      case this.SWAP_OWNER:
        return <SwapOwner>{
          type: 'SWAP_OWNER',
          oldOwner: { value: dataDecoded.parameters[1]?.value },
          newOwner: { value: dataDecoded.parameters[2]?.value },
        };
      case this.CHANGE_MASTER_COPY:
        return <ChangeImplementation>{
          type: 'CHANGE_MASTER_COPY',
          implementation: await this.addressInfoHelper.getOrDefault(
            chainId,
            safe.address,
          ),
        };
      case this.ENABLE_MODULE:
        return <EnableModule>{
          type: 'ENABLE_MODULE',
          module: await this.addressInfoHelper.getOrDefault(
            chainId,
            dataDecoded.parameters[0]?.value,
          ),
        };
      case this.DISABLE_MODULE:
        return <DisableModule>{
          type: 'DISABLE_MODULE',
          module: await this.addressInfoHelper.getOrDefault(
            chainId,
            dataDecoded.parameters[1]?.value,
          ),
        };
      case this.CHANGE_THRESHOLD:
        return <ChangeThreshold>{
          type: 'CHANGE_THRESHOLD',
          threshold: dataDecoded.parameters[0]?.value,
        };
      case this.SET_GUARD:
        const guardValue = dataDecoded.parameters[0]?.value;
        if (guardValue !== this.NULL_ADDRESS) {
          return <SetGuard>{
            type: 'SET_GUARD',
            guard: await this.addressInfoHelper.getOrDefault(
              chainId,
              guardValue,
            ),
          };
        }
        return <DeleteGuard>{
          type: 'DELETE_GUARD',
        };
    }
  }

  private mapTxStatus(transaction: MultisigTransaction, safe: Safe): string {
    if (transaction.isExecuted) {
      return transaction.isSuccessful ? 'SUCCESS' : 'FAILED';
    }
    if (safe.nonce > transaction.nonce) {
      return 'CANCELLED';
    }
    if (
      this.getConfirmationsCount(transaction) <
      this.getConfirmationsRequired(transaction, safe)
    ) {
      return 'AWAITING_CONFIRMATIONS';
    }
    return 'AWAITING_EXECUTION';
  }

  private getConfirmationsCount(transaction: MultisigTransaction): number {
    return transaction.confirmations?.length || 0;
  }

  private getConfirmationsRequired(
    transaction: MultisigTransaction,
    safe: Safe,
  ): number {
    return transaction.confirmationsRequired ?? safe.threshold;
  }

  private getMissingSigners(
    transaction: MultisigTransaction,
    safe: Safe,
    txStatus: string,
  ): string[] {
    console.log(transaction, safe, txStatus);
    const confirmedOwners =
      transaction.confirmations?.map((confirmation) => confirmation.owner) ??
      [];

    return safe.owners.filter((owner) => !confirmedOwners.includes(owner));
  }

  private mapExecutionInfo(
    transaction: MultisigTransaction,
    safe: Safe,
    txStatus: string,
  ): ExecutionInfo {
    const executionInfo = {
      type: 'MULTISIG',
      nonce: transaction.nonce,
      confirmationsRequired: this.getConfirmationsRequired(transaction, safe),
      confirmationsSubmitted: this.getConfirmationsCount(transaction),
    };

    if (txStatus === 'AWAITING_CONFIRMATIONS') {
      return {
        ...executionInfo,
        missingSigners: this.getMissingSigners(transaction, safe, txStatus),
      };
    }

    return executionInfo;
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
    if (!dataDecoded.parameters) {
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

  private checkSenderOrReceiver(transaction: MultisigTransaction): boolean {
    const { dataDecoded } = transaction;
    if (!dataDecoded) return false;
    return (
      this.TRANSFER_METHOD == dataDecoded.method ||
      this.getFromParam(dataDecoded, '') === transaction.safe ||
      this.getToParam(dataDecoded, '') === transaction.safe
    );
  }

  private isCustomTransaction(
    value: number,
    dataSize: number,
    operation: Operation,
  ): boolean {
    return (value > 0 && dataSize > 0) || operation !== 0;
  }

  private isEtherTransfer(value: number, dataSize: number): boolean {
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
      this.SETTINGS_CHANGE_METHODS.includes(transaction.dataDecoded?.method)
    );
  }

  private isValidTokenTransfer(transaction: MultisigTransaction): boolean {
    return (
      (this.isErc20Transfer(transaction) ||
        this.isErc721Transfer(transaction)) &&
      this.checkSenderOrReceiver(transaction)
    );
  }

  private async mapTransactionInfo(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<TransactionInfo> {
    const value = Number(transaction?.value) || 0;
    const dataSize = transaction.data
      ? (Buffer.byteLength(transaction.data) - 2) / 2
      : 0;

    if (this.isCustomTransaction(value, dataSize, transaction.operation)) {
      return await this.mapCustomTransaction(
        transaction,
        value,
        dataSize,
        chainId,
      );
    }

    if (this.isEtherTransfer(value, dataSize)) {
      return this.getToEtherTransfer(transaction, safe);
    }

    if (this.isSettingsChange(transaction, value, dataSize)) {
      return this.getSettingsChangeTransaction(chainId, transaction, safe);
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

    return this.mapCustomTransaction(transaction, value, dataSize, chainId); // TODO: default case
  }

  private filterAddressInfo(addressInfo: AddressInfo): AddressInfo {
    return {
      ...{ value: addressInfo.value },
      ...(addressInfo.name !== '' && { name: addressInfo.name }),
      ...(addressInfo.logoUri && { logoUri: addressInfo.logoUri }),
    };
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
    return {
      type: 'Custom',
      to: this.filterAddressInfo(toAddressInfo),
      dataSize: dataSize.toString(),
      value: value.toString(),
      methodName: transaction?.dataDecoded?.method || null,
      actionCount: this.getActionCount(transaction),
      isCancellation: this.isCancellation(transaction, dataSize),
    };
  }

  private async mapErc20Transfer(
    token: Token,
    chainId: string,
    transaction: MultisigTransaction,
  ): Promise<TransferTransaction> {
    const { dataDecoded } = transaction;
    const sender = this.getFromParam(dataDecoded, transaction.safe);
    const recipient = this.getToParam(dataDecoded, this.NULL_ADDRESS);
    const direction = this.mapTransferDirection(
      transaction.safe,
      sender,
      recipient,
    );

    const senderAddressInfo =
      sender === transaction.safe
        ? { value: sender }
        : await this.addressInfoHelper.getOrDefault(chainId, sender);

    const recipientAddressInfo =
      recipient === transaction.safe
        ? { value: recipient }
        : await this.addressInfoHelper.getOrDefault(chainId, recipient);

    return <TransferTransaction>{
      type: 'Transfer',
      sender: senderAddressInfo,
      recipient: recipientAddressInfo,
      direction,
      transferInfo: <Erc20TransferInfo>{
        type: 'ERC20',
        tokenAddress: token.address,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        logoUri: token.logoUri,
        decimals: token.decimals,
        value: this.getValueParam(dataDecoded, '0'),
      },
    };
  }

  private async mapErc721Transfer(
    token: Token,
    chainId: string,
    transaction: MultisigTransaction,
  ): Promise<TransferTransaction> {
    const { dataDecoded } = transaction;
    const sender = this.getFromParam(dataDecoded, transaction.safe);
    const recipient = this.getToParam(dataDecoded, this.NULL_ADDRESS);
    const direction = this.mapTransferDirection(
      transaction.safe,
      sender,
      recipient,
    );

    const senderAddressInfo =
      sender === transaction.safe
        ? { value: sender }
        : await this.addressInfoHelper.getOrDefault(chainId, sender);

    const recipientAddressInfo =
      recipient === transaction.safe
        ? { value: recipient }
        : await this.addressInfoHelper.getOrDefault(chainId, recipient);

    return <TransferTransaction>{
      type: 'Transfer',
      sender: senderAddressInfo,
      recipient: recipientAddressInfo,
      direction,
      transferInfo: <Erc721TransferInfo>{
        type: 'ERC721',
        tokenAddress: token.address,
        tokenId: this.getValueParam(dataDecoded, '0'),
        tokenName: token.name,
        tokenSymbol: token.symbol,
        logoUri: token.logoUri,
      },
    };
  }

  private getActionCount(transaction: MultisigTransaction): number | undefined {
    const { dataDecoded } = transaction;
    if (transaction?.dataDecoded?.method === 'multiSend') {
      const parameter = dataDecoded.parameters?.find(
        (parameter) => parameter.name === 'transactions',
      );
      return parameter?.valueDecoded?.length;
    }
  }

  private getToEtherTransfer(
    transaction: MultisigTransaction,
    safe: Safe,
  ): TransferTransaction {
    return {
      type: 'Transfer',
      sender: safe.address,
      recipient: transaction.to,
      direction: TransferDirection[TransferDirection.Outgoing].toUpperCase(),
      transferInfo: <NativeCoinTransferInfo>{
        value: transaction.value,
      },
    };
  }

  private async getSettingsChangeTransaction(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<SettingsChangeTransactionInfo> {
    return {
      type: 'SettingsChange',
      dataDecoded: transaction.dataDecoded,
      settingsInfo: await this.mapSettingsInfo(chainId, transaction, safe),
    };
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
      (!gasToken || gasToken === this.NULL_ADDRESS) &&
      (!refundReceiver || refundReceiver === this.NULL_ADDRESS) &&
      (!safeTxGas || safeTxGas === 60)
    );
  }

  private mapTransferDirection(safe: string, from: string, to: string): string {
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
}
