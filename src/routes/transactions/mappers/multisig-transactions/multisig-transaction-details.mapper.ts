import { Inject, Injectable } from '@nestjs/common';
import isEmpty from 'lodash/isEmpty';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import {
  MULTI_SEND_METHOD_NAME,
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
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { Erc20TransferMapper } from '@/routes/transactions/mappers/common/erc20-transfer.mapper';
import { Erc721TransferMapper } from '@/routes/transactions/mappers/common/erc721-transfer.mapper';
import { NativeCoinTransferMapper } from '@/routes/transactions/mappers/common/native-coin-transfer.mapper';
import { TransferTransactionInfo } from '@/routes/transactions/entities/transfer-transaction-info.entity';

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
    private readonly nativeCoinTransferMapper: NativeCoinTransferMapper,
    private readonly erc20TransferMapper: Erc20TransferMapper,
    private readonly erc721TransferMapper: Erc721TransferMapper,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async mapDetails(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
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
      transfers,
    ] = await Promise.all([
      this.transactionDataMapper.isTrustedDelegateCall(
        chainId,
        transaction.operation,
        transaction.to,
        transaction.dataDecoded,
      ),
      this.transactionDataMapper.buildAddressInfoIndex(
        chainId,
        transaction.dataDecoded,
      ),
      this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction),
      this.transactionInfoMapper.mapTransactionInfo(chainId, transaction),
      this.multisigTransactionExecutionDetailsMapper.mapMultisigExecutionDetails(
        chainId,
        transaction,
        safe,
      ),
      this._getRecipientAddressInfo(chainId, transaction.to),
      this._mapMultiSendTransfers({
        chainId,
        safe,
        dataDecoded: transaction.dataDecoded,
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
        transaction.dataDecoded,
        recipientAddressInfo,
        transaction.value,
        transaction.operation,
        isTrustedDelegateCall,
        isEmpty(addressInfoIndex) ? null : addressInfoIndex,
      ),
      txHash: transaction.transactionHash,
      detailedExecutionInfo,
      safeAppInfo,
      note,
      // @ts-expect-error - TODO: Decide on data structure
      transfers,
    };
  }

  // TODO: Make recursive for nested MultiSend calls
  private async _mapMultiSendTransfers(args: {
    chainId: string;
    safe: Safe;
    dataDecoded: MultisigTransaction['dataDecoded'];
  }): Promise<Array<TransferTransactionInfo>> {
    if (
      !args.dataDecoded?.parameters ||
      args.dataDecoded.method !== MULTI_SEND_METHOD_NAME
    ) {
      return [];
    }

    const transfers: Array<Promise<TransferTransactionInfo>> = [];

    for (const parameter of args.dataDecoded.parameters) {
      const isMultiSend =
        parameter.name === 'transactions' && parameter.type === 'bytes';

      if (!isMultiSend || !Array.isArray(parameter.valueDecoded)) {
        continue;
      }

      for (const batchedTransaction of parameter.valueDecoded) {
        const isNativeCoin =
          batchedTransaction.value && batchedTransaction.value !== '0';
        if (isNativeCoin) {
          transfers.push(
            this.nativeCoinTransferMapper.mapNativeCoinTransfer(
              args.chainId,
              {
                safe: args.safe.address,
                to: batchedTransaction.to,
                value: batchedTransaction.value,
              },
              null,
            ),
          );
          continue;
        }

        if (
          !this.transactionInfoMapper.isValidTokenTransfer(
            args.safe.address,
            batchedTransaction.dataDecoded,
          )
        ) {
          continue;
        }

        const token = await this.tokenRepository
          .getToken({
            chainId: args.chainId,
            address: batchedTransaction.to,
          })
          .catch(() => null);

        if (!token) {
          continue;
        }

        if (token.type === 'ERC20') {
          transfers.push(
            this.erc20TransferMapper.mapErc20Transfer(
              token,
              args.chainId,
              {
                safe: args.safe.address,
                dataDecoded: batchedTransaction.dataDecoded,
              },
              null,
            ),
          );
        }

        if (token.type === 'ERC721') {
          transfers.push(
            this.erc721TransferMapper.mapErc721Transfer(
              token,
              args.chainId,
              {
                safe: args.safe.address,
                dataDecoded: batchedTransaction.dataDecoded,
              },
              null,
            ),
          );
        }
      }
    }

    return await Promise.all(transfers);
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
