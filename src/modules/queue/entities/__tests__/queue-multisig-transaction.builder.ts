// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { QueueMultisigTransactionEntity } from '@/modules/queue/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { getAddress } from 'viem';
import type { Hex } from 'viem';

export function queueMultisigTransactionBuilder(): IBuilder<QueueMultisigTransactionEntity> {
  return new Builder<QueueMultisigTransactionEntity>()
    .with('safeTxHash', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('chainId', faker.string.numeric())
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('nonce', faker.number.int({ min: 0, max: 100 }))
    .with('proposer', getAddress(faker.finance.ethereumAddress()))
    .with('proposedByDelegate', null)
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
