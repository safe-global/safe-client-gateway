import { Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Safe } from '@/modules/safe/domain/entities/safe.entity';
import {
  MULTISIG_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '@/modules/transactions/routes/constants';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';
import { SafeAppInfoMapper } from '@/modules/transactions/routes/mappers/common/safe-app-info.mapper';
import { MultisigTransactionInfoMapper } from '@/modules/transactions/routes/mappers/common/transaction-info.mapper';
import { MultisigTransactionExecutionInfoMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionStatusMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionNoteMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-note.mapper';
import { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { DataDecodedParamHelper } from '@/modules/transactions/routes/mappers/common/data-decoded-param.helper';
import { type Address, getAddress, isAddress } from 'viem';
import { DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import { IDataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository.interface';

@Injectable()
export class MultisigTransactionMapper {
  constructor(
    @Inject(IDataDecoderRepository)
    private readonly dataDecoderRepository: IDataDecoderRepository,
    private readonly statusMapper: MultisigTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly executionInfoMapper: MultisigTransactionExecutionInfoMapper,
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
    private readonly noteMapper: MultisigTransactionNoteMapper,
    private readonly transactionVerifier: TransactionVerifierHelper,
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
  ) {}

  async mapTransaction(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
    dataDecoded: DataDecoded | null,
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
    );
    const executionInfo = this.executionInfoMapper.mapExecutionInfo(
      transaction,
      safe,
      txStatus,
    );
    const safeAppInfo = await this.safeAppInfoMapper.mapSafeAppInfo(
      chainId,
      transaction,
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

  /**
   * Prefetches the AddressInfo for the given transactions.
   * This method collects all unique addresses from the transactions and fetches their AddressInfo,
   * to prevent multiple parallel requests for the same addresses.
   */
  public async prefetchAddressInfos(args: {
    chainId: string;
    transactions: Array<MultisigTransaction>;
  }): Promise<void> {
    const addresses: Set<Address> = new Set();
    for (const transaction of args.transactions) {
      addresses.add(transaction.safe);
      addresses.add(transaction.to);

      const dataDecoded =
        await this.dataDecoderRepository.getTransactionDataDecoded({
          chainId: args.chainId,
          transaction,
        });
      if (dataDecoded) {
        const fromAddress = this.dataDecodedParamHelper.getFromParam(
          dataDecoded,
          transaction.safe,
        );
        if (isAddress(fromAddress)) {
          addresses.add(getAddress(fromAddress));
        }
        const toAddress = this.dataDecodedParamHelper.getToParam(
          dataDecoded,
          transaction.safe,
        );
        if (isAddress(toAddress)) {
          addresses.add(getAddress(toAddress));
        }
      }
    }
    await this.addressInfoHelper.getCollection(
      args.chainId,
      Array.from(addresses),
      ['TOKEN', 'CONTRACT'],
    );
  }
}
