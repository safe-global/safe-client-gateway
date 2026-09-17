// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Hash } from 'viem';
import { getAddress } from 'viem';
import { messageConfirmationBuilder } from '@/modules/messages/domain/entities/__tests__/message-confirmation.builder';
import type { SafeQueueMessage } from '@/modules/safe-queue/entities/message.entity';
import { ProposalRoute } from '@/modules/safe-queue/entities/proposal-route.entity';
import { mapSafeQueueMessageToMessage } from '@/modules/safe-queue/mappers/message.mapper';

function safeQueueMessageBuilder(
  overrides: Partial<SafeQueueMessage> = {},
): SafeQueueMessage {
  return {
    messageHash: faker.string.hexadecimal({ length: 64 }) as Hash,
    chainId: faker.number.int({ min: 1, max: 100_000 }),
    safe: getAddress(faker.finance.ethereumAddress()),
    message: faker.word.words({ count: { min: 1, max: 5 } }),
    proposer: getAddress(faker.finance.ethereumAddress()),
    proposedBy: null,
    proposedVia: ProposalRoute.Owner,
    preparedSignature: faker.string.hexadecimal({ length: 130 }) as Hash,
    originName: faker.word.words(),
    originUrl: faker.internet.url({ protocol: 'https', appendSlash: false }),
    created: faker.date.past(),
    modified: faker.date.recent(),
    confirmations: faker.helpers.multiple(
      () => messageConfirmationBuilder().build(),
      { count: { min: 1, max: 3 } },
    ),
    ...overrides,
  };
}

describe('mapSafeQueueMessageToMessage', () => {
  it('credits the proposer as proposedBy on the OWNER route', () => {
    const owner = getAddress(faker.finance.ethereumAddress());
    const msg = safeQueueMessageBuilder({
      proposer: owner,
      proposedBy: null,
      proposedVia: ProposalRoute.Owner,
    });

    const result = mapSafeQueueMessageToMessage(msg);

    expect(result.proposedBy).toBe(owner);
  });

  it('credits the owner Safe, not the signing EOA, on the NESTED_OWNER route', () => {
    const ownerSafe = getAddress(faker.finance.ethereumAddress());
    const nestedOwner = getAddress(faker.finance.ethereumAddress());
    const msg = safeQueueMessageBuilder({
      proposer: ownerSafe,
      proposedBy: nestedOwner,
      proposedVia: ProposalRoute.NestedOwner,
    });

    const result = mapSafeQueueMessageToMessage(msg);

    expect(result.proposedBy).toBe(ownerSafe);
  });

  it('does not leak queue-only fields onto the mapped Message', () => {
    const msg = safeQueueMessageBuilder();

    const result = mapSafeQueueMessageToMessage(msg);

    expect(result).not.toHaveProperty('chainId');
    expect(result).not.toHaveProperty('originName');
    expect(result).not.toHaveProperty('originUrl');
    expect(result).not.toHaveProperty('proposer');
    expect(result).not.toHaveProperty('proposedVia');
  });
});
