// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { PolicyOperation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import {
  activeConfirmations,
  currentConfirmations,
  isRemoval,
} from '@/modules/policies/domain/utils/policy-state.utils';
import { NULL_ADDRESS } from '@/routes/common/constants';

/**
 * Two confirmations for the same access, differing only in chain position and
 * policy address.
 */
function accessHistory(args: {
  policies: Array<{
    policy: PolicyConfirmation['policy'];
    blockNumber: number;
    logIndex?: number;
  }>;
}): Array<PolicyConfirmation> {
  const target = getAddress(faker.finance.ethereumAddress());

  return args.policies.map(({ policy, blockNumber, logIndex = 0 }) =>
    policyConfirmationBuilder()
      .with('target', target)
      .with('policy', policy)
      .with('removed', policy === NULL_ADDRESS)
      .with('blockNumber', blockNumber)
      .with('logIndex', logIndex)
      .build(),
  );
}

describe('isRemoval', () => {
  it('should treat a zero policy address as a removal', () => {
    const confirmation = policyConfirmationBuilder()
      .with('policy', NULL_ADDRESS)
      .with('removed', false)
      .build();

    expect(isRemoval(confirmation)).toBe(true);
  });

  it('should trust the removed flag', () => {
    const confirmation = policyConfirmationBuilder()
      .with('removed', true)
      .build();

    expect(isRemoval(confirmation)).toBe(true);
  });

  it('should not treat a set policy as a removal', () => {
    const confirmation = policyConfirmationBuilder()
      .with('removed', false)
      .build();

    expect(isRemoval(confirmation)).toBe(false);
  });
});

describe('currentConfirmations', () => {
  it('should keep the newest confirmation per access', () => {
    const older = 100;
    const newer = 200;
    const [first, second] = accessHistory({
      policies: [
        {
          policy: getAddress(faker.finance.ethereumAddress()),
          blockNumber: older,
        },
        {
          policy: getAddress(faker.finance.ethereumAddress()),
          blockNumber: newer,
        },
      ],
    });

    const result = currentConfirmations([first, second]);

    expect(result).toStrictEqual([second]);
  });

  it('should break a tie within a block on the log index', () => {
    const [first, second] = accessHistory({
      policies: [
        {
          policy: getAddress(faker.finance.ethereumAddress()),
          blockNumber: 100,
          logIndex: 1,
        },
        {
          policy: getAddress(faker.finance.ethereumAddress()),
          blockNumber: 100,
          logIndex: 4,
        },
      ],
    });

    expect(currentConfirmations([first, second])).toStrictEqual([second]);
  });

  it('should be independent of input order', () => {
    const [older, newer] = accessHistory({
      policies: [
        { policy: getAddress(faker.finance.ethereumAddress()), blockNumber: 1 },
        { policy: getAddress(faker.finance.ethereumAddress()), blockNumber: 2 },
      ],
    });

    expect(currentConfirmations([older, newer])).toStrictEqual(
      currentConfirmations([newer, older]),
    );
  });

  it('should keep one entry per access', () => {
    const first = policyConfirmationBuilder().build();
    const second = policyConfirmationBuilder().build();

    const result = currentConfirmations([first, second]);

    expect(result).toHaveLength(2);
  });

  it('should treat the same target and selector under a different operation as another access', () => {
    const call = policyConfirmationBuilder()
      .with('operation', PolicyOperation.Call)
      .build();
    const delegateCall = {
      ...call,
      operation: PolicyOperation.DelegateCall,
      blockNumber: call.blockNumber + 1,
    };

    expect(currentConfirmations([call, delegateCall])).toHaveLength(2);
  });

  it('should return the newest access first', () => {
    const first = policyConfirmationBuilder().with('blockNumber', 1).build();
    const second = policyConfirmationBuilder().with('blockNumber', 5).build();

    expect(currentConfirmations([first, second])).toStrictEqual([
      second,
      first,
    ]);
  });

  it('should return an empty list for no confirmations', () => {
    expect(currentConfirmations([])).toStrictEqual([]);
  });
});

describe('activeConfirmations', () => {
  it('should drop an access whose latest confirmation is a removal', () => {
    const policy = getAddress(faker.finance.ethereumAddress());
    const [added, removed] = accessHistory({
      policies: [
        { policy, blockNumber: 100 },
        { policy: NULL_ADDRESS, blockNumber: 200 },
      ],
    });

    expect(activeConfirmations([added, removed])).toStrictEqual([]);
  });

  it('should restore an access that was removed and re-added', () => {
    const policy = getAddress(faker.finance.ethereumAddress());
    const [added, removed, readded] = accessHistory({
      policies: [
        { policy, blockNumber: 100 },
        { policy: NULL_ADDRESS, blockNumber: 200 },
        { policy, blockNumber: 300 },
      ],
    });

    expect(activeConfirmations([added, removed, readded])).toStrictEqual([
      readded,
    ]);
  });

  it('should keep an access whose removal is not the latest event', () => {
    const policy = getAddress(faker.finance.ethereumAddress());
    const [removed, added] = accessHistory({
      policies: [
        { policy: NULL_ADDRESS, blockNumber: 100 },
        { policy, blockNumber: 200 },
      ],
    });

    expect(activeConfirmations([removed, added])).toStrictEqual([added]);
  });

  it('should not let a removal of one access affect another', () => {
    const active = policyConfirmationBuilder().build();
    const [added, removed] = accessHistory({
      policies: [
        { policy: getAddress(faker.finance.ethereumAddress()), blockNumber: 1 },
        { policy: NULL_ADDRESS, blockNumber: 2 },
      ],
    });

    expect(activeConfirmations([active, added, removed])).toStrictEqual([
      active,
    ]);
  });
});
