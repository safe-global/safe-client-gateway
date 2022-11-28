import { Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction as DomainMultisigTransaction } from '../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../domain/safe/entities/safe.entity';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { AddressInfoHelper } from '../common/address-info/address-info.helper';
import { Page } from '../common/entities/page.entity';
import {
  AddOwner,
  ChangeImplementation,
  ChangeThreshold,
  CustomTxInfo as CustomTransactionInfo,
  DeleteGuard,
  DisableModule,
  EnableModule,
  ExecutionInfo,
  MultisigTransaction,
  NativeCoinTransferInfo,
  RemoveOwner,
  SetFallbackHandler,
  SetGuard,
  SettingsChangeTransactionInfo,
  SettingsInfo,
  SwapOwner,
  TransactionInfo,
  TransactionSummary,
  TransferDirection,
  TransferTransactionInfo,
} from './entities/multisig-transaction.entity';
import {
  ADD_OWNER_WITH_THRESHOLD,
  CHANGE_MASTER_COPY,
  CHANGE_THRESHOLD,
  DISABLE_MODULE,
  ENABLE_MODULE,
  REMOVE_OWNER,
  SETTINGS_CHANGE_METHODS,
  SET_FALLBACK_HANDLER,
  SET_GUARD,
  SWAP_OWNER,
} from './mappers/multisig-transaction.mapper';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    private readonly addressInfoHelper: AddressInfoHelper,
  ) {}

  private readonly NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

  async getMultiSigTransactions(
    chainId: string,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    executed?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    const multisigTransactions =
      await this.safeRepository.getMultiSigTransactions(
        chainId,
        safeAddress,
        executionDateGte,
        executionDateLte,
        to,
        value,
        nonce,
        executed,
        limit,
        offset,
      );

    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const results = await Promise.all(
      multisigTransactions.results.map(async (multiSignTransaction) => ({
        type: 'TRANSACTION',
        transaction: await this.getSummary(
          chainId,
          multiSignTransaction,
          safeInfo,
        ),
        conflictType: 'None',
      })),
    );

    return {
      ...multisigTransactions,
      results,
    };
  }

  private async getSummary(
    chainId: string,
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): Promise<TransactionSummary> {
    const txStatus = this.getTxStatus(multiSignTransaction, safeInfo);
    const txInfo = await this.getTransactionInfo(
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
      executionInfo: this.getExecutionInfo(
        multiSignTransaction,
        safeInfo,
        txStatus,
      ),
    };
  }

  private getTxStatus(
    multiSignTransaction: DomainMultisigTransaction,
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
    multiSignTransaction: DomainMultisigTransaction,
  ): number {
    return multiSignTransaction.confirmations?.length ?? 0;
  }

  private getConfirmationsRequired(
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): number {
    return multiSignTransaction.confirmationsRequired ?? safeInfo.threshold;
  }

  private getExecutionInfo(
    multiSignTransaction: DomainMultisigTransaction,
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

  private getMissingSigners(
    multiSignTransaction: DomainMultisigTransaction,
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

  private async getTransactionInfo(
    chainId: string,
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): Promise<TransactionInfo> {
    const value = Number(multiSignTransaction?.value) || 0;
    const dataSize = multiSignTransaction.data
      ? (Buffer.byteLength(multiSignTransaction.data) - 2) / 2
      : 0;

    let transactionInfo: TransactionInfo;

    if ((value > 0 && dataSize > 0) || multiSignTransaction.operation !== 0) {
      transactionInfo = this.getCustomTransactionInfo(
        multiSignTransaction,
        value,
        dataSize,
      );
    } else if (value > 0 && dataSize === 0) {
      transactionInfo = this.getToEtherTransfer(multiSignTransaction, safeInfo);
    } else if (
      value === 0 &&
      dataSize > 0 &&
      multiSignTransaction.safe === multiSignTransaction.to &&
      SETTINGS_CHANGE_METHODS.includes(multiSignTransaction.dataDecoded?.method)
    ) {
      transactionInfo = await this.getSettingsChangeTransaction(
        chainId,
        multiSignTransaction,
        safeInfo,
      );
    } else {
      transactionInfo = this.getCustomTransactionInfo(
        multiSignTransaction,
        value,
        dataSize,
      ); // TODO: default case
    }

    return transactionInfo;
  }

  private getCustomTransactionInfo(
    multiSignTransaction: DomainMultisigTransaction,
    value: number,
    dataSize: number,
  ): CustomTransactionInfo {
    return {
      type: 'Custom', // TODO:
      to: {},
      dataSize: dataSize.toString(),
      value: value.toString(),
      methodName: multiSignTransaction?.dataDecoded?.method || null,
      actionCount: this.getActionCount(multiSignTransaction),
      isCancellation: this.isCancellation(multiSignTransaction, dataSize),
    };
  }

  private getActionCount(
    multiSignTransaction: DomainMultisigTransaction,
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
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): TransferTransactionInfo {
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
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): Promise<SettingsChangeTransactionInfo> {
    return {
      type: 'SettingsChange',
      dataDecoded: multiSignTransaction.dataDecoded,
      settingsInfo: await this.getSettingsInfo(
        chainId,
        multiSignTransaction,
        safeInfo,
      ),
    };
  }

  private async getSettingsInfo(
    chainId: string,
    multiSignTransaction: DomainMultisigTransaction,
    safeInfo: Safe,
  ): Promise<SettingsInfo | undefined> {
    const { dataDecoded } = multiSignTransaction;
    switch (dataDecoded.method) {
      case SET_FALLBACK_HANDLER:
        return <SetFallbackHandler>{
          type: 'SET_FALLBACK_HANDLER',
          handler: Object.values(dataDecoded)[0],
        };
      case ADD_OWNER_WITH_THRESHOLD:
        return <AddOwner>{
          type: 'ADD_OWNER',
          owner: { value: dataDecoded.parameters[0]?.value },
          threshold: Number(dataDecoded.parameters[1]?.value),
        };
      case REMOVE_OWNER:
        return <RemoveOwner>{
          type: 'REMOVE_OWNER',
          owner: Object.values(dataDecoded)[1],
          threshold: Object.values(dataDecoded)[2],
        };
      case SWAP_OWNER:
        return <SwapOwner>{
          type: 'SWAP_OWNER',
          oldOwner: Object.values(dataDecoded)[1],
          newOwner: Object.values(dataDecoded)[2],
        };
      case CHANGE_MASTER_COPY:
        return <ChangeImplementation>{
          type: 'CHANGE_MASTER_COPY',
          implementation: await this.addressInfoHelper.getOrDefault(
            chainId,
            safeInfo.address,
          ),
        };
      case ENABLE_MODULE:
        return <EnableModule>{
          type: 'ENABLE_MODULE',
          module: await this.addressInfoHelper.getOrDefault(
            chainId,
            <string>Object.values(dataDecoded)[0],
          ),
        };
      case DISABLE_MODULE:
        return <DisableModule>{
          type: 'DISABLE_MODULE',
          module: await this.addressInfoHelper.getOrDefault(
            chainId,
            <string>Object.values(dataDecoded)[1],
          ),
        };
      case CHANGE_THRESHOLD:
        return <ChangeThreshold>{
          type: 'CHANGE_THRESHOLD',
          threshold: Object.values(dataDecoded)[0],
        };
      case SET_GUARD:
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

  private isCancellation(
    multiSignTransaction: DomainMultisigTransaction,
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
