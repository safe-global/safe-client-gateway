import { Inject, Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { SafeRepository } from '../../../../domain/safe/safe.repository';
import { ISafeRepository } from '../../../../domain/safe/safe.repository.interface';
import { Token } from '../../../../domain/tokens/entities/token.entity';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { ITokenRepository } from '../../../../domain/tokens/token.repository.interface';
import {
  ILoggingService,
  LoggingService,
} from '../../../../logging/logging.interface';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { NULL_ADDRESS } from '../../../common/constants';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import {
  MULTISIG_TRANSACTION_PREFIX,
  TRANSACTION_ID_SEPARATOR,
} from '../../constants';
import { TransactionData } from '../../entities/transaction-data.entity';
import {
  MultisigConfirmationDetails,
  MultisigExecutionDetails,
} from '../../entities/transaction-details/multisig-execution-details.entity';
import { TransactionDetails } from '../../entities/transaction-details/transaction-details.entity';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { SafeAppInfoMapper } from '../common/safe-app-info.mapper';
import { TransactionDataMapper } from '../common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '../common/transaction-info.mapper';
import { MultisigTransactionStatusMapper } from './multisig-transaction-status.mapper';

@Injectable()
export class MultisigTransactionDetailsMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly statusMapper: MultisigTransactionStatusMapper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly transactionDataMapper: TransactionDataMapper,
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async mapDetails(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<TransactionDetails> {
    const txStatus = this.statusMapper.mapTransactionStatus(transaction, safe);
    const [
      isTrustedDelegateCall,
      addressInfoIndex,
      safeAppInfo,
      txInfo,
      detailedExecutionInfo,
      recipientAddressInfo,
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
      this.transactionInfoMapper.mapTransactionInfo(chainId, transaction, safe),
      this._mapMultisigExecutionDetails(chainId, transaction, txStatus, safe),
      this._getRecipientAddressInfo(chainId, transaction.to),
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
    };
  }

  private async _mapMultisigExecutionDetails(
    chainId: string,
    transaction: MultisigTransaction,
    txStatus: TransactionStatus,
    safe: Safe,
  ): Promise<MultisigExecutionDetails> {
    const signers = safe.owners.map((owner) => new AddressInfo(owner));
    const gasToken = transaction.gasToken ?? NULL_ADDRESS;
    const confirmationsRequired =
      transaction.confirmationsRequired ?? safe.threshold;
    const confirmations = !transaction.confirmations
      ? []
      : transaction.confirmations.map(
          (confirmation) =>
            new MultisigConfirmationDetails(
              new AddressInfo(confirmation.owner),
              confirmation.signature,
              confirmation.submissionDate.getTime(),
            ),
        );

    const promises: Promise<unknown>[] = [];
    promises.push(
      gasToken != NULL_ADDRESS
        ? this.tokenRepository.getToken(chainId, gasToken)
        : Promise.resolve(null),
    );
    promises.push(
      transaction.executor
        ? this.addressInfoHelper.getOrDefault(chainId, transaction.executor, [
            'CONTRACT',
          ])
        : Promise.resolve(null),
    );
    promises.push(
      this.addressInfoHelper.getOrDefault(
        chainId,
        transaction.refundReceiver ?? NULL_ADDRESS,
        ['CONTRACT'],
      ),
    );
    promises.push(
      txStatus === TransactionStatus.Cancelled
        ? this._getRejectors(chainId, transaction, safe)
        : Promise.resolve(null),
    );
    const [gasTokenInfo, executor, refundReceiver, rejectors] =
      await Promise.all(promises);

    return new MultisigExecutionDetails(
      transaction.submissionDate.getTime(),
      transaction.nonce,
      transaction.safeTxGas?.toString() ?? '0',
      transaction.baseGas?.toString() ?? '0',
      transaction.gasPrice?.toString() ?? '0',
      gasToken,
      refundReceiver as AddressInfo,
      transaction.safeTxHash,
      executor as AddressInfo,
      signers,
      confirmationsRequired,
      confirmations,
      rejectors as AddressInfo[] | null,
      gasTokenInfo as Token | null,
      transaction.trusted,
    );
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
    address: string,
  ): Promise<AddressInfo> {
    return await this.addressInfoHelper.getOrDefault(chainId, address, [
      'TOKEN',
      'CONTRACT',
    ]);
  }

  /**
   * Gets an array of {@link AddressInfo} representing the confirmations of the replacement
   * transaction for the {@link Transaction} passed in.
   *
   * When a transaction is cancelled, another transaction replaces it, having the same nonce
   * and isExecuted attribute set to true. This function retrieves that transaction, and
   * collects its confirmations as rejectors.
   *
   * @param chainId - chain id to use
   * @param transaction - transaction to use
   * @param safe - safe to use
   * @returns confirmations for the replacement transaction
   */
  private async _getRejectors(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<AddressInfo[] | null> {
    const replacementTxsPage =
      await this.safeRepository.getMultisigTransactions(
        chainId,
        safe.address,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        transaction.nonce.toString(),
      );

    if (isEmpty(replacementTxsPage.results)) {
      this.loggingService.debug(
        `Replacement transaction with nonce ${transaction.nonce} not found for cancelled transaction ${transaction.transactionHash}`,
      );
      return null;
    }

    const replacementTx = replacementTxsPage.results[0];
    return replacementTx.confirmations
      ? replacementTx.confirmations.map((c) => new AddressInfo(c.owner))
      : null;
  }
}
