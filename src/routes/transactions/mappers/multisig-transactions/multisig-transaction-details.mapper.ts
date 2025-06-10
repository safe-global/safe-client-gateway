import { Injectable } from '@nestjs/common';
import isEmpty from 'lodash/isEmpty';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import {
  MULTISIG_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '@/routes/transactions/constants';
import { TransactionData } from '@/routes/transactions/entities/transaction-data.entity';
import { TransactionDetails } from '@/routes/transactions/entities/transaction-details/transaction-details.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';
import { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { MultisigTransactionExecutionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import { MultisigTransactionStatusMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionNoteMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-note.mapper';
import { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';

@Injectable()
export class MultisigTransactionDetailsMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly statusMapper: MultisigTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly transactionDataMapper: TransactionDataMapper,
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
    private readonly multisigTransactionExecutionDetailsMapper: MultisigTransactionExecutionDetailsMapper,
    private readonly noteMapper: MultisigTransactionNoteMapper,
    private readonly transactionVerifier: TransactionVerifierHelper,
  ) {}

  async mapDetails(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
    dataDecoded: DataDecoded | null,
  ): Promise<TransactionDetails> {
    // TODO: This should be located on the domain layer but only route layer exists
    this.transactionVerifier.verifyApiTransaction({
      chainId,
      safe,
      transaction,
    });

    const txStatus = this.statusMapper.mapTransactionStatus(transaction, safe);
    const note = this.noteMapper.mapTxNote(transaction);
    const [
      isTrustedDelegateCall,
      addressInfoIndex,
      safeAppInfo,
      txInfo,
      detailedExecutionInfo,
      recipientAddressInfo,
      tokenInfoIndex,
    ] = await Promise.all([
      this.transactionDataMapper.isTrustedDelegateCall(
        chainId,
        transaction.operation,
        transaction.to,
        dataDecoded,
      ),
      this.transactionDataMapper.buildAddressInfoIndex(chainId, dataDecoded),
      this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction),
      this.transactionInfoMapper.mapTransactionInfo(
        chainId,
        transaction,
        dataDecoded,
      ),
      this.multisigTransactionExecutionDetailsMapper.mapMultisigExecutionDetails(
        chainId,
        transaction,
        safe,
      ),
      this._getRecipientAddressInfo(chainId, transaction.to),
      this.transactionDataMapper.buildTokenInfoIndex({
        chainId,
        safeAddress: transaction.safe,
        dataDecoded,
      }),
    ]);

    return {
      safeAddress: safe.address,
      txId: `${MULTISIG_TRANSACTION_PREFIX}${TRANSACTION_ID_SEPARATOR}${safe.address}${TRANSACTION_ID_SEPARATOR}${transaction.safeTxHash}`,
      executedAt: transaction.executionDate?.getTime() ?? null,
      txStatus,
      txInfo,
      txData: new TransactionData(
        transaction.data,
        dataDecoded,
        recipientAddressInfo,
        transaction.value,
        transaction.operation,
        isTrustedDelegateCall,
        isEmpty(addressInfoIndex) ? null : addressInfoIndex,
        isEmpty(tokenInfoIndex) ? null : tokenInfoIndex,
      ),
      txHash: transaction.transactionHash,
      detailedExecutionInfo,
      safeAppInfo,
      note,
    };
  }

  /**
   * Tries to get the {@link AddressInfo} related to the address from a Token, and
   * fallbacks to a Contract. If none can be found, a default {@link AddressInfo}
   * containing just the input address is returned.
   *
   * @param chainId - chain id to use
   * @param address - the address of the source to which we want to retrieve its metadata
   * @returns {@link AddressInfo} containing the address metadata
   */
  private async _getRecipientAddressInfo(
    chainId: string,
    address: `0x${string}`,
  ): Promise<AddressInfo> {
    return await this.addressInfoHelper.getOrDefault(chainId, address, [
      'TOKEN',
      'CONTRACT',
    ]);
  }
}
