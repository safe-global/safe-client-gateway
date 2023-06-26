import { Inject, Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { SafeRepository } from '../../../../domain/safe/safe.repository';
import { ISafeRepository } from '../../../../domain/safe/safe.repository.interface';
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
  MultisigConfirmationDetails,
  MultisigExecutionDetails,
} from '../../entities/transaction-details/multisig-execution-details.entity';

@Injectable()
export class MultisigTransactionExecutionDetailsMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async mapMultisigExecutionDetails(
    chainId: string,
    transaction: MultisigTransaction,
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

    const [gasTokenInfo, executor, refundReceiver, rejectors] =
      await Promise.all([
        gasToken != NULL_ADDRESS
          ? this.tokenRepository.getToken(chainId, gasToken)
          : Promise.resolve(null),
        transaction.executor
          ? this.addressInfoHelper.getOrDefault(chainId, transaction.executor, [
              'CONTRACT',
            ])
          : Promise.resolve(null),
        this.addressInfoHelper.getOrDefault(
          chainId,
          transaction.refundReceiver ?? NULL_ADDRESS,
          ['CONTRACT'],
        ),
        this._getRejectors(chainId, transaction, safe),
      ]);

    return new MultisigExecutionDetails(
      transaction.submissionDate.getTime(),
      transaction.nonce,
      transaction.safeTxGas?.toString() ?? '0',
      transaction.baseGas?.toString() ?? '0',
      transaction.gasPrice?.toString() ?? '0',
      gasToken,
      refundReceiver,
      transaction.safeTxHash,
      executor,
      signers,
      confirmationsRequired,
      confirmations,
      rejectors,
      gasTokenInfo,
      transaction.trusted,
    );
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
        undefined,
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
