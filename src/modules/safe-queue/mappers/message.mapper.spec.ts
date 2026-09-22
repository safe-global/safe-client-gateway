// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { safeQueueMessageBuilder } from '@/modules/safe-queue/entities/__tests__/safe-queue-message.builder';
import { ProposalRoute } from '@/modules/safe-queue/entities/proposal-route.entity';
import { mapSafeQueueMessageToMessage } from '@/modules/safe-queue/mappers/message.mapper';

describe('mapSafeQueueMessageToMessage', () => {
  it('credits the proposer as proposedBy on the OWNER route', () => {
    const owner = getAddress(faker.finance.ethereumAddress());
    const msg = safeQueueMessageBuilder()
      .with('proposer', owner)
      .with('proposedBy', null)
      .with('proposedVia', ProposalRoute.Owner)
      .build();

    const result = mapSafeQueueMessageToMessage(msg);

    expect(result.proposedBy).toBe(owner);
  });

  it('credits the owner Safe, not the signing EOA, on the NESTED_OWNER route', () => {
    const ownerSafe = getAddress(faker.finance.ethereumAddress());
    const nestedOwner = getAddress(faker.finance.ethereumAddress());
    const msg = safeQueueMessageBuilder()
      .with('proposer', ownerSafe)
      .with('proposedBy', nestedOwner)
      .with('proposedVia', ProposalRoute.NestedOwner)
      .build();

    const result = mapSafeQueueMessageToMessage(msg);

    expect(result.proposedBy).toBe(ownerSafe);
  });

  it('does not leak queue-only fields onto the mapped Message', () => {
    const msg = safeQueueMessageBuilder().build();

    const result = mapSafeQueueMessageToMessage(msg);

    expect(result).not.toHaveProperty('chainId');
    expect(result).not.toHaveProperty('originName');
    expect(result).not.toHaveProperty('originUrl');
    expect(result).not.toHaveProperty('proposer');
    expect(result).not.toHaveProperty('proposedVia');
  });
});
