// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { SignatureType } from '#/domain/common/entities/signature-type.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type {
  SafeQueueConfirmation,
  SafeQueueMultisigTransactionEntity,
} from '#/modules/safe-queue/entities/multisig-transaction.entity';
import { ProposalRoute } from '#/modules/safe-queue/entities/proposal-route.entity';
import { parseOrigin } from '#/modules/safe-queue/helpers/origin.helper';

export function safeQueueConfirmationBuilder(): IBuilder<SafeQueueConfirmation> {
  return new Builder<SafeQueueConfirmation>()
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 130 }) as Hex)
    .with('signatureType', SignatureType.Eoa)
    .with('created', faker.date.recent())
    .with('modified', faker.date.recent());
}

export function safeQueueMultisigTransactionBuilder(): IBuilder<SafeQueueMultisigTransactionEntity> {
  return new Builder<SafeQueueMultisigTransactionEntity>()
    .with('safeTxHash', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('chainId', faker.string.numeric())
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('nonce', faker.number.int({ min: 0, max: 100 }))
    .with('proposer', getAddress(faker.finance.ethereumAddress()))
    .with('proposedBy', null)
    .with('proposedVia', ProposalRoute.Owner)
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.string.numeric())
    .with('data', null)
    .with('operation', Operation.CALL)
    .with('safeTxGas', null)
    .with('baseGas', null)
    .with('gasPrice', null)
    .with('gasToken', null)
    .with('refundReceiver', null)
    .with('failed', false)
    .with('notes', null)
    .with('originName', null)
    .with('originUrl', null)
    .with('txHash', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('created', faker.date.recent())
    .with('modified', faker.date.recent())
    .with('confirmations', []);
}

/**
 * The queue-service record of a transaction built with the domain builders,
 * so a spec can serve an existing {@link MultisigTransaction} fixture from the
 * queue service. Confirmations without a signature are dropped: the queue
 * service only stores signed ones.
 */
export function safeQueueMultisigTransactionFrom(
  transaction: MultisigTransaction,
  chainId: string,
): IBuilder<SafeQueueMultisigTransactionEntity> {
  const { originName, originUrl, note } = parseOrigin(transaction.origin);
  return safeQueueMultisigTransactionBuilder()
    .with('safeTxHash', transaction.safeTxHash)
    .with('chainId', chainId)
    .with('safe', transaction.safe)
    .with('nonce', transaction.nonce)
    .with('proposer', transaction.proposer)
    .with('proposedBy', transaction.proposedByDelegate)
    .with(
      'proposedVia',
      transaction.proposedByDelegate
        ? ProposalRoute.Delegate
        : ProposalRoute.Owner,
    )
    .with('to', transaction.to)
    .with('value', transaction.value)
    .with('data', transaction.data)
    .with('operation', transaction.operation)
    .with(
      'safeTxGas',
      transaction.safeTxGas === null ? null : transaction.safeTxGas.toString(),
    )
    .with(
      'baseGas',
      transaction.baseGas === null ? null : transaction.baseGas.toString(),
    )
    .with('gasPrice', transaction.gasPrice)
    .with('gasToken', transaction.gasToken)
    .with('refundReceiver', transaction.refundReceiver)
    .with(
      'failed',
      transaction.isSuccessful === null ? null : !transaction.isSuccessful,
    )
    .with('notes', note ?? null)
    .with('originName', originName ?? null)
    .with('originUrl', originUrl ?? null)
    .with('txHash', transaction.transactionHash)
    .with('created', transaction.submissionDate)
    .with('modified', transaction.modified ?? transaction.submissionDate)
    .with(
      'confirmations',
      (transaction.confirmations ?? []).flatMap((confirmation) => {
        return confirmation.signature === null
          ? []
          : [
              {
                owner: confirmation.owner,
                signature: confirmation.signature,
                signatureType: confirmation.signatureType,
                created: confirmation.submissionDate,
                modified: confirmation.submissionDate,
              },
            ];
      }),
    );
}
