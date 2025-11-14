import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '@/modules/safe/domain/entities/module-transaction.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import {
  MODULE_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '@/modules/transactions/routes/constants';
import { ModuleExecutionInfo } from '@/modules/transactions/routes/entities/module-execution-info.entity';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';
import { MultisigTransactionInfoMapper } from '@/modules/transactions/routes/mappers/common/transaction-info.mapper';
import { ModuleTransactionStatusMapper } from '@/modules/transactions/routes/mappers/module-transactions/module-transaction-status.mapper';
import { DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';

@Injectable()
export class ModuleTransactionMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly statusMapper: ModuleTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
  ) {}

  async mapTransaction(
    chainId: string,
    transaction: ModuleTransaction,
    dataDecoded: DataDecoded | null,
  ): Promise<Transaction> {
    const txStatus = this.statusMapper.mapTransactionStatus(transaction);
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      transaction,
      dataDecoded,
    );
    const executionInfo = new ModuleExecutionInfo(
      await this.addressInfoHelper.getOrDefault(chainId, transaction.module, [
        'CONTRACT',
      ]),
    );

    return new Transaction(
      `${MODULE_TRANSACTION_PREFIX}${TRANSACTION_ID_SEPARATOR}${transaction.safe}${TRANSACTION_ID_SEPARATOR}${transaction.moduleTransactionId}`,
      transaction.executionDate.getTime(),
      txStatus,
      txInfo,
      executionInfo,
      null,
      null,
      transaction.transactionHash,
    );
  }
}
