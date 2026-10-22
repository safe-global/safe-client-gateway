// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { safePolicyGuardConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/safe-policy-guard-configuration.builder';
import type {
  ApplicationWindow,
  DelayedPolicyChange,
  QueuedApplyConfiguration,
  QueuedConfigurationRequest,
} from '#/modules/policies/domain/entities/delayed-policy-change.entity';
import { policyIndexerConfigurationRootBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/configuration-root.builder';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerGuardPolicyKind,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  PendingDelayedGuardPoliciesStatus,
  type PendingTransaction,
} from '#/modules/policies/domain/entities/pending-policy.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import {
  applicationWindowOf,
  createdAtOf,
  guardPolicyKindsOf,
  guardPolicyTypeOfKind,
  queuedApplyStatus,
} from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import { pendingTransactionOf } from '#/modules/policies/domain/utils/queued-calls.utils';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';

/** A queued transaction with `confirmations` of 2 signatures, summarised. */
function queuedTransaction(confirmations: number): PendingTransaction {
  return pendingTransactionOf(
    multisigTransactionBuilder()
      .with('confirmationsRequired', 2)
      .with(
        'confirmations',
        Array.from({ length: confirmations }, () =>
          confirmationBuilder().build(),
        ),
      )
      .build(),
  );
}

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
  it('should return the guard and window of a pending root', () => {
    const onChain = policyIndexerConfigurationRootBuilder()
      .with('status', 'PENDING')
      .build();

    expect(applicationWindowOf(onChain)).toStrictEqual({
      guard: onChain.guard,
      readyAt: onChain.readyAt,
      expiresAt: onChain.expiresAt,
    });
  });

  it.each(['APPLIED', 'INVALIDATED'] as const)(
    'should return null for a %s root',
    (status: PolicyIndexerConfigurationRoot['status']) => {
      const onChain = policyIndexerConfigurationRootBuilder()
        .with('status', status)
        .build();

      expect(applicationWindowOf(onChain)).toBeNull();
    },
  );

  it('should return null without an on-chain root', () => {
    expect(applicationWindowOf(null)).toBeNull();
  });
});

describe('delayed changes', () => {
  const now = Math.floor(faker.date.recent().getTime() / 1000);
  const guard = getAddress(faker.finance.ethereumAddress());
  const configurations = [policyConfigurationBuilder().build()];
  const root = configurationRoot(configurations);

  function queuedApply(confirmations: number): QueuedApplyConfiguration {
    return {
      kind: 'apply',
      root,
      guard,
      configurations,
      transaction: queuedTransaction(confirmations),
    };
  }

  function queuedRequest(): QueuedConfigurationRequest {
    return { kind: 'request', root, guard, transaction: queuedTransaction(1) };
  }

  function change(
    overrides: Partial<Omit<DelayedPolicyChange, 'root'>>,
  ): DelayedPolicyChange {
    return {
      root,
      onChain: null,
      stored: null,
      queuedRequest: null,
      queuedApply: null,
      ...overrides,
    };
  }

  describe('queuedApplyStatus', () => {
    const window: ApplicationWindow = {
      guard,
      readyAt: now + 60,
      expiresAt: now + 3_660,
    };

    it('should be in signing while confirmations are missing', () => {
      expect(queuedApplyStatus(queuedApply(1), window, now)).toBe(
        PendingDelayedGuardPoliciesStatus.ApplicationInSigning,
      );
    });

    it('should be pending application when signed before readyAt', () => {
      expect(
        queuedApplyStatus(queuedApply(2), window, window.readyAt - 1),
      ).toBe(PendingDelayedGuardPoliciesStatus.PendingApplication);
    });

    it('should be ready when signed from readyAt', () => {
      expect(queuedApplyStatus(queuedApply(2), window, window.readyAt)).toBe(
        PendingDelayedGuardPoliciesStatus.ApplicationReady,
      );
    });
  });

  describe('createdAtOf', () => {
    it("should be the stored draft's creation time", () => {
      const stored = safePolicyGuardConfigurationBuilder().build();

      expect(
        createdAtOf(change({ stored, queuedRequest: queuedRequest() })),
      ).toBe(Math.floor(stored.createdAt.getTime() / 1000));
    });

    it("should fall back to the queued request's proposal time", () => {
      const request = queuedRequest();

      expect(
        createdAtOf(
          change({ queuedRequest: request, queuedApply: queuedApply(1) }),
        ),
      ).toBe(request.transaction.proposedAt);
    });

    it("should fall back to the queued apply's proposal time", () => {
      const apply = queuedApply(1);

      expect(createdAtOf(change({ queuedApply: apply }))).toBe(
        apply.transaction.proposedAt,
      );
    });

    it('should be null for a root only the chain knows', () => {
      const onChain = policyIndexerConfigurationRootBuilder().build();

      expect(createdAtOf(change({ onChain }))).toBeNull();
    });
  });
});
