// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import type { TokenRepository } from '#/modules/tokens/domain/token.repository';
import { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';
import {
  MultisigConfirmationDetails,
  MultisigExecutionDetails,
} from '#/modules/transactions/routes/entities/transaction-details/multisig-execution-details.entity';
import { AddressInfoHelper } from '#/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '#/routes/common/constants';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

@Injectable()
export class MultisigTransactionExecutionDetailsMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
  ) {}

  async mapMultisigExecutionDetails(
    chainId: string,
    transaction: MultisigTransaction,
    safe: Safe,
  ): Promise<MultisigExecutionDetails> {
    const signers = safe.owners.map((owner) => new AddressInfo(owner));
    const gasToken = transaction.gasToken ?? NULL_ADDRESS;
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
    const proposer = transaction.proposer
      ? new AddressInfo(transaction.proposer)
      : null;
    const proposedByDelegate = transaction.proposedByDelegate
      ? new AddressInfo(transaction.proposedByDelegate)
      : null;

    const [gasTokenInfo, executor, refundReceiver] = await Promise.all([
      gasToken !== NULL_ADDRESS
        ? this.tokenRepository.getToken({ chainId, address: gasToken })
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
    ]);

    return new MultisigExecutionDetails(
      transaction.submissionDate.getTime(),
      transaction.nonce,
      transaction.safeTxGas?.toString() ?? '0',
      transaction.baseGas?.toString() ?? '0',
      transaction.gasPrice?.toString() ?? '0',
      gasToken,
      transaction.fee ?? '0',
      transaction.payment ?? '0',
      refundReceiver,
      transaction.safeTxHash,
      executor,
      signers,
      transaction.confirmationsRequired,
      confirmations,
      gasTokenInfo,
      transaction.trusted,
      proposer,
      proposedByDelegate,
    );
  }
}
