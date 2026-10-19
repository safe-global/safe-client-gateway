// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyIndexerGuardPolicyKind } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import {
  guardPolicyKindsOf,
  guardPolicyTypeOfKind,
} from '#/modules/policies/domain/utils/policy.utils';

describe('guardPolicyKindsOf', () => {
  it('should map each guard-enforced type to its indexer kind', () => {
    expect(
      guardPolicyKindsOf([PolicyType.Erc20Transfer, PolicyType.MultiSend]),
    ).toStrictEqual(['ERC20_TRANSFER', 'MULTISEND']);
  });

  it('should return no kinds for types the guard does not enforce', () => {
    // The caller reads no guard bindings at all for these.
    expect(
      guardPolicyKindsOf([PolicyType.SpendingLimit, PolicyType.Proposer]),
    ).toStrictEqual([]);
  });
});

describe('guardPolicyTypeOfKind', () => {
  it.each<[PolicyIndexerGuardPolicyKind, PolicyType]>([
    ['ERC20_TRANSFER', PolicyType.Erc20Transfer],
    ['COSIGNER', PolicyType.Cosigner],
    ['ALLOW', PolicyType.Allow],
    ['DENY', PolicyType.Deny],
    ['NATIVE_TRANSFER', PolicyType.NativeTransfer],
    ['MULTISEND', PolicyType.MultiSend],
  ])('should report %s as %s', (kind, type) => {
    expect(guardPolicyTypeOfKind(kind)).toBe(type);
  });

  it.each<PolicyIndexerGuardPolicyKind>([
    'ERC20_APPROVE',
    'ALLOWED_MODULE',
    'UNKNOWN',
  ])('should not report %s', (kind) => {
    expect(guardPolicyTypeOfKind(kind)).toBeNull();
  });
});
