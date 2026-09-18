// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Hash } from 'viem';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { messageConfirmationBuilder } from '@/modules/messages/domain/entities/__tests__/message-confirmation.builder';
import type { SafeQueueMessage } from '@/modules/safe-queue/entities/message.entity';
import { ProposalRoute } from '@/modules/safe-queue/entities/proposal-route.entity';

export function safeQueueMessageBuilder(): IBuilder<SafeQueueMessage> {
  return new Builder<SafeQueueMessage>()
    .with('messageHash', faker.string.hexadecimal({ length: 64 }) as Hash)
    .with('chainId', faker.number.int({ min: 1, max: 100_000 }))
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('message', faker.word.words({ count: { min: 1, max: 5 } }))
    .with('proposer', getAddress(faker.finance.ethereumAddress()))
    .with('proposedBy', null)
    .with('proposedVia', ProposalRoute.Owner)
    .with(
      'preparedSignature',
      faker.string.hexadecimal({ length: 130 }) as Hash,
    )
    .with('originName', faker.word.words())
    .with(
      'originUrl',
      faker.internet.url({ protocol: 'https', appendSlash: false }),
    )
    .with('created', faker.date.past())
    .with('modified', faker.date.recent())
    .with(
      'confirmations',
      faker.helpers.multiple(() => messageConfirmationBuilder().build(), {
        count: { min: 1, max: 3 },
      }),
    );
}
