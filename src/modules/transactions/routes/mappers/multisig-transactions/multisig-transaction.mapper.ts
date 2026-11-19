// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { DataDecoded } from '#/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { SafeAppInfoMapper } from '#/modules/safe-apps/mappers/safe-app-info.mapper';
import {
  MULTISIG_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '#/modules/transactions/routes/constants';
import { Transaction } from '#/modules/transactions/routes/entities/transaction.entity';
import { TransactionVerifierHelper } from '#/modules/transactions/routes/helpers/transaction-verifier.helper';
import { MultisigTransactionInfoMapper } from '#/modules/transactions/routes/mappers/common/transaction-info.mapper';
import { MultisigTransactionExecutionInfoMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionNoteMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-note.mapper';
import { MultisigTransactionStatusMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-status.mapper';
import type { AddressLookups } from '#/routes/common/address-info/address-lookups';

@Injectable()
export class MultisigTransactionMapper {
  constructor(
    private readonly statusMapper: MultisigTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly executionInfoMapper: MultisigTransactionExecutionInfoMapper,
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
    private readonly noteMapper: MultisigTransactionNoteMapper,
    private readonly transactionVerifier: TransactionVerifierHelper,
  ) {}

  async mapTransaction(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
    dataDecoded: DataDecoded | null,
    addressLookups: AddressLookups,
  ): Promise<Transaction> {
    // TODO: This should be located on the domain layer but only route layer exists
    this.transactionVerifier.verifyApiTransaction({
      chainId,
      safe,
      transaction,
    });
    const txStatus = this.statusMapper.mapTransactionStatus(transaction, safe);
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      transaction,
      dataDecoded,
      addressLookups,
    );
    const executionInfo = this.executionInfoMapper.mapExecutionInfo(
      transaction,
      safe,
      txStatus,
    );
    const safeAppInfo = await this.safeAppInfoMapper.mapSafeAppInfo(
      chainId,
      transaction.origin,
      transaction.safeTxHash,
    );
    const note = this.noteMapper.mapTxNote(transaction);

    return new Transaction(
      `${MULTISIG_TRANSACTION_PREFIX}${TRANSACTION_ID_SEPARATOR}${transaction.safe}${TRANSACTION_ID_SEPARATOR}${transaction.safeTxHash}`,
      (transaction.executionDate ?? transaction.submissionDate).getTime(),
      txStatus,
      txInfo,
      executionInfo,
      safeAppInfo,
      note,
      transaction.transactionHash,
    );
  }
}
