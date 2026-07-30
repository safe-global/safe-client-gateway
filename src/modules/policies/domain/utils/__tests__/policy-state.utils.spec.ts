// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { PolicyOperation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { accessSelector } from '@/modules/policies/domain/utils/policy-access.utils';
import {
  isRemoval,
  policyGroups,
} from '@/modules/policies/domain/utils/policy-state.utils';
import { NULL_ADDRESS } from '@/routes/common/constants';

/**
 * A history of events on one `(target, selector, operation)` tuple, oldest first.
 */
function accessHistory(
  events: Array<{
    policy: PolicyConfirmation['policy'];
    policyType?: string;
    blockNumber: number;
    logIndex?: number;
  }>,
): Array<PolicyConfirmation> {
  const target = getAddress(faker.finance.ethereumAddress());

  return events.map(({ policy, policyType, blockNumber, logIndex = 0 }) =>
    policyConfirmationBuilder()
      .with('target', target)
      .with('policy', policy)
      .with('policyType', policyType ?? 'ERC20TransferPolicy')
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

describe('policyGroups', () => {
  it('should group the events of a tuple, keyed by its access word', () => {
    // The reported case: three `configure` calls on one access. They are one
    // group, so a resolver can fold their payloads.
    const policy = getAddress(faker.finance.ethereumAddress());
    const history = accessHistory([
      { policy, blockNumber: 465, logIndex: 1 },
      { policy, blockNumber: 469, logIndex: 1 },
      { policy, blockNumber: 473, logIndex: 1 },
    ]);

    const result = policyGroups(history);

    expect(result).toStrictEqual([
      {
        access: accessSelector(history[0]),
        latest: history[2],
        confirmations: history,
      },
    ]);
  });

  it('should order a group oldest first, whatever order the events arrive in', () => {
    const policy = getAddress(faker.finance.ethereumAddress());
    const history = accessHistory([
      { policy, blockNumber: 1, logIndex: 2 },
      { policy, blockNumber: 1, logIndex: 5 },
      { policy, blockNumber: 2, logIndex: 0 },
    ]);

    const [group] = policyGroups([...history].reverse());

    expect(group.confirmations).toStrictEqual(history);
    expect(group.latest).toStrictEqual(history[2]);
  });

  it('should keep one group per tuple', () => {
    const first = policyConfirmationBuilder().build();
    const second = policyConfirmationBuilder().build();

    expect(policyGroups([first, second])).toHaveLength(2);
  });

  it('should treat the same target and selector under another operation as another tuple', () => {
    const call = policyConfirmationBuilder()
      .with('operation', PolicyOperation.Call)
      .build();
    const delegateCall = {
      ...call,
      operation: PolicyOperation.DelegateCall,
      transactionHash: `0x${'ab'.repeat(32)}` as const,
    };

    expect(policyGroups([call, delegateCall])).toHaveLength(2);
  });

  it('should return the most recently configured tuple first', () => {
    const older = policyConfirmationBuilder().with('blockNumber', 1).build();
    const newer = policyConfirmationBuilder().with('blockNumber', 5).build();

    expect(
      policyGroups([older, newer]).map((group) => group.latest),
    ).toStrictEqual([newer, older]);
  });

  describe('the bound policy', () => {
    it('should drop a tuple whose newest event is a removal', () => {
      const policy = getAddress(faker.finance.ethereumAddress());
      const history = accessHistory([
        { policy, blockNumber: 100 },
        { policy: NULL_ADDRESS, blockNumber: 200 },
      ]);

      expect(policyGroups(history)).toStrictEqual([]);
    });

    it('should keep a tuple whose removal is not the newest event', () => {
      const policy = getAddress(faker.finance.ethereumAddress());
      const [removed, added] = accessHistory([
        { policy: NULL_ADDRESS, blockNumber: 100 },
        { policy, blockNumber: 200 },
      ]);

      const [group] = policyGroups([removed, added]);

      expect(group.confirmations).toStrictEqual([added]);
    });

    it('should ignore the events of a policy that has been replaced', () => {
      // Only the events of the bound policy describe its storage.
      const replaced = getAddress(faker.finance.ethereumAddress());
      const bound = getAddress(faker.finance.ethereumAddress());
      const history = accessHistory([
        { policy: replaced, blockNumber: 100 },
        { policy: replaced, blockNumber: 200 },
        { policy: bound, blockNumber: 300 },
      ]);

      const [group] = policyGroups(history);

      expect(group.confirmations).toStrictEqual([history[2]]);
    });

    it('should ignore the events of another policy type on the same tuple', () => {
      // A tuple that used to hold an ERC20TransferPolicy and now holds an
      // AllowPolicy is an AllowPolicy: the allowlist events must not leak into
      // it, nor into the allowlist resolver.
      const history = accessHistory([
        {
          policy: getAddress(faker.finance.ethereumAddress()),
          policyType: 'ERC20TransferPolicy',
          blockNumber: 100,
        },
        {
          policy: getAddress(faker.finance.ethereumAddress()),
          policyType: 'AllowPolicy',
          blockNumber: 200,
        },
      ]);

      const [group] = policyGroups(history);

      expect(group.latest.policyType).toBe('AllowPolicy');
      expect(group.confirmations).toStrictEqual([history[1]]);
    });

    it('should keep the events of a policy re-bound after a removal', () => {
      // The policy contract keeps its own storage across a removal of the guard
      // mapping, so its earlier configure calls still describe what it enforces.
      const policy = getAddress(faker.finance.ethereumAddress());
      const history = accessHistory([
        { policy, blockNumber: 100 },
        { policy: NULL_ADDRESS, blockNumber: 200 },
        { policy, blockNumber: 300 },
      ]);

      const [group] = policyGroups(history);

      expect(group.confirmations).toStrictEqual([history[0], history[2]]);
    });

    it('should not let a removal on one tuple affect another', () => {
      const active = policyConfirmationBuilder().build();
      const history = accessHistory([
        { policy: getAddress(faker.finance.ethereumAddress()), blockNumber: 1 },
        { policy: NULL_ADDRESS, blockNumber: 2 },
      ]);

      expect(
        policyGroups([active, ...history]).map((group) => group.latest),
      ).toStrictEqual([active]);
    });
  });

  describe('overlapping pages', () => {
    it('should keep one entry per log', () => {
      // Offset pagination over a growing history can return the same log twice;
      // folding a cumulative payload twice would count it twice.
      const confirmation = policyConfirmationBuilder().build();

      const [group] = policyGroups([confirmation, { ...confirmation }]);

      expect(group.confirmations).toStrictEqual([confirmation]);
    });

    it('should keep two logs of the same transaction apart', () => {
      const policy = getAddress(faker.finance.ethereumAddress());
      const transactionHash = `0x${'cd'.repeat(32)}` as const;
      const target = getAddress(faker.finance.ethereumAddress());
      const first = policyConfirmationBuilder()
        .with('target', target)
        .with('policy', policy)
        .with('transactionHash', transactionHash)
        .with('blockNumber', 1)
        .with('logIndex', 1)
        .build();
      const second = policyConfirmationBuilder()
        .with('target', target)
        .with('policy', policy)
        .with('transactionHash', transactionHash)
        .with('blockNumber', 1)
        .with('logIndex', 2)
        .build();

      const [group] = policyGroups([first, second]);

      expect(group.confirmations).toStrictEqual([first, second]);
    });
  });

  it('should return an empty list for no confirmations', () => {
    expect(policyGroups([])).toStrictEqual([]);
  });
});
