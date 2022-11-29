import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../domain/safe/entities/safe.entity';
import { AddressInfoHelper } from '../../common/address-info/address-info.helper';
import { AddressInfo } from '../../common/entities/address-info.entity';
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
  TransferTransaction,
  TransferDirection,
  NativeCoinTransferInfo,
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

  constructor(private readonly addressInfoHelper: AddressInfoHelper) {}

  async mapToTransactionSummary(
    chainId: string,
    multiSignTransaction: MultisigTransaction,
    safeInfo: Safe,
  ): Promise<TransactionSummary> {
    const txStatus = this.mapTxStatus(multiSignTransaction, safeInfo);
    const txInfo = await this.mapTransactionInfo(
      chainId,
      multiSignTransaction,
      safeInfo,
    );

    return {
      id: `multisig_${multiSignTransaction.safe}_${multiSignTransaction.safeTxHash}`,
      timestamp:
        multiSignTransaction?.executionDate?.getTime() ??
        multiSignTransaction?.submissionDate?.getTime(),
      txStatus,
      txInfo,
      executionInfo: this.mapExecutionInfo(
        multiSignTransaction,
        safeInfo,
        txStatus,
      ),
    };
  }

  private async mapSettingsInfo(
    chainId: string,
    multiSignTransaction: MultisigTransaction,
    safeInfo: Safe,
  ): Promise<SettingsInfo | undefined> {
    const { dataDecoded } = multiSignTransaction;
    switch (dataDecoded.method) {
      case this.SET_FALLBACK_HANDLER:
        return <SetFallbackHandler>{
          type: 'SET_FALLBACK_HANDLER',
          handler: Object.values(dataDecoded)[0],
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
          owner: Object.values(dataDecoded)[1],
          threshold: Object.values(dataDecoded)[2],
        };
      case this.SWAP_OWNER:
        return <SwapOwner>{
          type: 'SWAP_OWNER',
          oldOwner: Object.values(dataDecoded)[1],
          newOwner: Object.values(dataDecoded)[2],
        };
      case this.CHANGE_MASTER_COPY:
        return <ChangeImplementation>{
          type: 'CHANGE_MASTER_COPY',
          implementation: await this.addressInfoHelper.getOrDefault(
            chainId,
            safeInfo.address,
          ),
        };
      case this.ENABLE_MODULE:
        return <EnableModule>{
          type: 'ENABLE_MODULE',
          module: await this.addressInfoHelper.getOrDefault(
            chainId,
            <string>Object.values(dataDecoded)[0],
          ),
        };
      case this.DISABLE_MODULE:
        return <DisableModule>{
          type: 'DISABLE_MODULE',
          module: await this.addressInfoHelper.getOrDefault(
            chainId,
            <string>Object.values(dataDecoded)[1],
          ),
        };
      case this.CHANGE_THRESHOLD:
        return <ChangeThreshold>{
          type: 'CHANGE_THRESHOLD',
          threshold: Object.values(dataDecoded)[0],
        };
      case this.SET_GUARD:
        const guardValue = <string>Object.values(dataDecoded)[0];
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

  private mapTxStatus(
    multiSignTransaction: MultisigTransaction,
    safeInfo: Safe,
  ): string {
    if (multiSignTransaction.isExecuted) {
      if (multiSignTransaction.isSuccessful) {
        return 'SUCCESS';
      } else {
        return 'FAILED';
      }
    }
    if (safeInfo.nonce > multiSignTransaction.nonce) {
      return 'CANCELLED';
    }
    if (
      this.getConfirmationsCount(multiSignTransaction) <
      this.getConfirmationsRequired(multiSignTransaction, safeInfo)
    ) {
      return 'AWAITING_CONFIRMATIONS';
    }
    return 'AWAITING_EXECUTION';
  }

  private getConfirmationsCount(
    multiSignTransaction: MultisigTransaction,
  ): number {
    return multiSignTransaction.confirmations?.length ?? 0;
  }

  private getConfirmationsRequired(
    multiSignTransaction: MultisigTransaction,
    safeInfo: Safe,
  ): number {
    return multiSignTransaction.confirmationsRequired ?? safeInfo.threshold;
  }

  private getMissingSigners(
    multiSignTransaction: MultisigTransaction,
    safeInfo: Safe,
    txStatus: string,
  ): string[] {
    console.log(multiSignTransaction, safeInfo, txStatus);
    const confirmedOwners =
      multiSignTransaction.confirmations?.map(
        (confirmation) => confirmation.owner,
      ) ?? [];

    return safeInfo.owners.filter((owner) => !confirmedOwners.includes(owner));
  }

  private mapExecutionInfo(
    multiSignTransaction: MultisigTransaction,
    safeInfo: Safe,
    txStatus: string,
  ): ExecutionInfo {
    const executionInfo = {
      type: 'MULTISIG',
      nonce: multiSignTransaction.nonce,
      confirmationsRequired: this.getConfirmationsRequired(
        multiSignTransaction,
        safeInfo,
      ),
      confirmationsSubmitted: this.getConfirmationsCount(multiSignTransaction),
    };

    if (txStatus === 'AWAITING_CONFIRMATIONS') {
      return {
        ...executionInfo,
        missingSigners: this.getMissingSigners(
          multiSignTransaction,
          safeInfo,
          txStatus,
        ),
      };
    }

    return executionInfo;
  }

  private async mapTransactionInfo(
    chainId: string,
    multiSignTransaction: MultisigTransaction,
    safeInfo: Safe,
  ): Promise<TransactionInfo> {
    const value = Number(multiSignTransaction?.value) || 0;
    const dataSize = multiSignTransaction.data
      ? (Buffer.byteLength(multiSignTransaction.data) - 2) / 2
      : 0;

    let transactionInfo: TransactionInfo;

    if ((value > 0 && dataSize > 0) || multiSignTransaction.operation !== 0) {
      transactionInfo = await this.mapCustomTransaction(
        multiSignTransaction,
        value,
        dataSize,
        chainId,
      );
    } else if (value > 0 && dataSize === 0) {
      transactionInfo = this.getToEtherTransfer(multiSignTransaction, safeInfo);
    } else if (
      value === 0 &&
      dataSize > 0 &&
      multiSignTransaction.safe === multiSignTransaction.to &&
      this.SETTINGS_CHANGE_METHODS.includes(
        multiSignTransaction.dataDecoded?.method,
      )
    ) {
      transactionInfo = await this.getSettingsChangeTransaction(
        chainId,
        multiSignTransaction,
        safeInfo,
      );
    } else {
      transactionInfo = await this.mapCustomTransaction(
        multiSignTransaction,
        value,
        dataSize,
        chainId,
      ); // TODO: default case
    }

    return transactionInfo;
  }

  private filterAddressInfo(
    addressInfo: AddressInfo | null,
  ): AddressInfo | null {
    if (!addressInfo) {
      return addressInfo;
    }

    return {
      ...{ value: addressInfo.value },
      ...(addressInfo.name !== '' && { name: addressInfo.name }),
      ...(addressInfo.logoUri && { logoUri: addressInfo.logoUri }),
    };
  }

  private async mapCustomTransaction(
    multiSignTransaction: MultisigTransaction,
    value: number,
    dataSize: number,
    chainId: string,
  ): Promise<CustomTransactionInfo> {
    const toAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      multiSignTransaction.to,
    );
    return {
      type: 'Custom',
      to: this.filterAddressInfo(toAddressInfo),
      dataSize: dataSize.toString(),
      value: value.toString(),
      methodName: multiSignTransaction?.dataDecoded?.method || null,
      actionCount: this.getActionCount(multiSignTransaction),
      isCancellation: this.isCancellation(multiSignTransaction, dataSize),
    };
  }

  private getActionCount(
    multiSignTransaction: MultisigTransaction,
  ): number | undefined {
    const { dataDecoded } = multiSignTransaction;
    if (multiSignTransaction?.dataDecoded?.method === 'multiSend') {
      const param = dataDecoded.parameters?.find(
        (p) => p.name === 'transactions',
      );
      return param?.valueDecoded?.length;
    }
  }

  private getToEtherTransfer(
    multiSignTransaction: MultisigTransaction,
    safeInfo: Safe,
  ): TransferTransaction {
    return {
      type: 'Transfer',
      sender: safeInfo.address,
      recipient: multiSignTransaction.to,
      direction: TransferDirection.Outgoing,
      transferInfo: <NativeCoinTransferInfo>{
        value: multiSignTransaction.value,
      },
    };
  }

  private async getSettingsChangeTransaction(
    chainId: string,
    multiSignTransaction: MultisigTransaction,
    safeInfo: Safe,
  ): Promise<SettingsChangeTransactionInfo> {
    return {
      type: 'SettingsChange',
      dataDecoded: multiSignTransaction.dataDecoded,
      settingsInfo: await this.mapSettingsInfo(
        chainId,
        multiSignTransaction,
        safeInfo,
      ),
    };
  }

  private isCancellation(
    multiSignTransaction: MultisigTransaction,
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
    } = multiSignTransaction;

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
}
