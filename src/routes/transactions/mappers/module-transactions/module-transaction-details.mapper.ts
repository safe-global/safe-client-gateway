import { Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { ModuleTransaction } from '../../../../domain/safe/entities/module-transaction.entity';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import {
  MODULE_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '../../constants';
import { TransactionData } from '../../entities/transaction-data.entity';
import { ModuleExecutionDetails } from '../../entities/transaction-details/module-execution-details.entity';
import { TransactionDetails } from '../../entities/transaction-details/transaction-details.entity';
import { TransactionDataMapper } from '../common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '../common/transaction-info.mapper';
import { ModuleTransactionStatusMapper } from './module-transaction-status.mapper';
import { ReadableDescriptionsMapper } from '../common/readable-descriptions.mapper';

@Injectable()
export class ModuleTransactionDetailsMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly statusMapper: ModuleTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly transactionDataMapper: TransactionDataMapper,
    private readonly readableDescriptionsMapper: ReadableDescriptionsMapper,
  ) {}

  async mapDetails(
    chainId: string,
    transaction: ModuleTransaction,
  ): Promise<TransactionDetails> {
    const [moduleAddress, txInfo, txData] = await Promise.all([
      this.addressInfoHelper.getOrDefault(chainId, transaction.module, [
        'CONTRACT',
      ]),
      this.transactionInfoMapper.mapTransactionInfo(chainId, transaction),
      this.mapTransactionData(chainId, transaction),
    ]);

    return {
      safeAddress: transaction.safe,
      txId: `${MODULE_TRANSACTION_PREFIX}${TRANSACTION_ID_SEPARATOR}${transaction.safe}${TRANSACTION_ID_SEPARATOR}${transaction.moduleTransactionId}`,
      executedAt: transaction.executionDate?.getTime() ?? null,
      txStatus: this.statusMapper.mapTransactionStatus(transaction),
      txInfo,
      txData,
      txHash: transaction.transactionHash,
      detailedExecutionInfo: new ModuleExecutionDetails(moduleAddress),
      safeAppInfo: null,
    };
  }

  private async mapTransactionData(
    chainId: string,
    transaction: ModuleTransaction,
  ): Promise<TransactionData> {
    const [
      addressInfoIndex,
      trustedDelegateCallTarget,
      toAddress,
      readableDescription,
    ] = await Promise.all([
      this.transactionDataMapper.buildAddressInfoIndex(
        chainId,
        transaction.dataDecoded,
      ),
      this.transactionDataMapper.isTrustedDelegateCall(
        chainId,
        transaction.operation,
        transaction.to,
        transaction.dataDecoded,
      ),
      this.addressInfoHelper.getOrDefault(chainId, transaction.to, [
        'TOKEN',
        'CONTRACT',
      ]),
      this.readableDescriptionsMapper.mapReadableDescription(
        transaction.to,
        transaction.data,
        chainId,
      ),
    ]);

    return {
      to: toAddress,
      value: transaction.value,
      hexData: transaction.data,
      dataDecoded: transaction.dataDecoded,
      operation: transaction.operation,
      addressInfoIndex: isEmpty(addressInfoIndex) ? null : addressInfoIndex,
      trustedDelegateCallTarget,
      readableDescription,
    };
  }
}
