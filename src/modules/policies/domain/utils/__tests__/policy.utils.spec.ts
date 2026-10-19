// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { policyIndexerConfigurationRootBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/configuration-root.builder';
import type { PolicyIndexerGuardPolicyKind } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import {
  activeRootsRuleOf,
  applicationWindowOf,
  guardPolicyKindsOf,
  guardPolicyTypeOfKind,
  isRootApplicable,
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

describe('applicationWindowOf', () => {
  const root = policyIndexerConfigurationRootBuilder()
    .with('status', 'PENDING')
    .build();
  const expiry = faker.number.int({ min: 60, max: 86_400 });

  it('should close the window at readyAt + EXPIRY', () => {
    expect(applicationWindowOf(root, expiry)).toStrictEqual({
      guard: root.guard,
      readyAt: root.readyAt,
      expiresAt: root.readyAt + expiry,
    });
  });

  it('should leave the window open-ended while EXPIRY is unknown', () => {
    expect(applicationWindowOf(root, undefined)?.expiresAt).toBeNull();
    expect(isRootApplicable(root, undefined, root.readyAt + expiry)).toBe(true);
  });

  it.each(['APPLIED', 'INVALIDATED'] as const)(
    'should have no window for a %s root',
    (status) => {
      const settled = { ...root, status };

      expect(applicationWindowOf(settled, expiry)).toBeNull();
      expect(isRootApplicable(settled, undefined, root.readyAt)).toBe(false);
    },
  );

  it('should not be applicable from readyAt + EXPIRY on', () => {
    expect(isRootApplicable(root, expiry, root.readyAt + expiry - 1)).toBe(
      true,
    );
    expect(isRootApplicable(root, expiry, root.readyAt + expiry)).toBe(false);
  });
});

describe('activeRootsRuleOf', () => {
  const now = faker.number.int({ min: 1_000_000, max: 2_000_000_000 });

  it('should count drafts younger than the draft lifetime', () => {
    const draftLifetime = faker.number.int({ min: 60, max: 86_400 });

    expect(
      activeRootsRuleOf({
        roots: [],
        expiries: new Map(),
        draftLifetime,
        now,
      }).draftsSince,
    ).toStrictEqual(new Date((now - draftLifetime) * 1_000));
  });

  it('should count every draft without a draft lifetime', () => {
    expect(
      activeRootsRuleOf({
        roots: [],
        expiries: new Map(),
        draftLifetime: null,
        now,
      }).draftsSince,
    ).toBeNull();
  });
});
