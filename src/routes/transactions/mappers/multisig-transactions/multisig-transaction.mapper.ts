import { Inject, Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import {
  MULTISIG_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '@/routes/transactions/constants';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';
import { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { MultisigTransactionExecutionInfoMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionStatusMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-status.mapper';
import { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { getAddress, isAddress } from 'viem';
import { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';

@Injectable()
export class MultisigTransactionMapper {
  constructor(
    @Inject(IDataDecoderRepository)
    private readonly dataDecoderRepository: IDataDecoderRepository,
    private readonly statusMapper: MultisigTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly executionInfoMapper: MultisigTransactionExecutionInfoMapper,
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
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

    return new Transaction(
      `${MULTISIG_TRANSACTION_PREFIX}${TRANSACTION_ID_SEPARATOR}${transaction.safe}${TRANSACTION_ID_SEPARATOR}${transaction.safeTxHash}`,
      (transaction.executionDate ?? transaction.submissionDate).getTime(),
      txStatus,
      txInfo,
      executionInfo,
      safeAppInfo,
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
    const addresses: Set<`0x${string}`> = new Set();
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
