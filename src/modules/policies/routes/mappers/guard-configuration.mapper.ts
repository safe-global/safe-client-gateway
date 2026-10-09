// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { type Address, type Hex, isAddressEqual, zeroAddress } from 'viem';
import { z } from 'zod';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafePolicyGuardDecoder } from '@/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerSafePolicy,
} from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  type PendingGuardConfiguration,
  PendingGuardConfigurationStatus,
  type PendingTransaction,
} from '@/modules/policies/domain/entities/pending-policy.entity';
import {
  type PolicyConfiguration,
  PolicyConfigurationSchema,
} from '@/modules/policies/domain/entities/policy-configuration.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import type { StoredPolicyConfiguration } from '@/modules/policies/domain/entities/stored-policy-configuration.entity';
import {
  getPolicyTypeOfContract,
  getSafePolicyGuardDeployments,
} from '@/modules/policies/domain/policy-deployments.constants';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';
import { guardPolicyTypeOfKind } from '@/modules/policies/routes/mappers/guard-policy.mapper';
import {
  pendingTransactionOf,
  queuedCalls,
} from '@/modules/policies/routes/mappers/queued-calls.utils';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';

/** A `requestConfiguration` call in the queue. */
type QueuedRequest = { guard: Address; transaction: PendingTransaction };

/** An `applyConfiguration` call in the queue. */
type QueuedApply = {
  guard: Address;
  configurations: Array<PolicyConfiguration>;
  transaction: PendingTransaction;
};

/** Everything known about one root of the Safe. */
type RootFacts = {
  root: Hex;
  onChain: PolicyIndexerConfigurationRoot | null;
  stored: StoredPolicyConfiguration | null;
  request: QueuedRequest | null;
  apply: QueuedApply | null;
};

/**
 * Works out where each delayed `SafePolicyGuard` configuration of a Safe
 * stands, one item per root.
 *
 * A root's facts come from three places: the guard's on-chain state (the
 * indexer), the configurations CGW stored, and the Safe's transaction queue.
 * The first matching rule decides its status:
 *
 * 1. A queued `applyConfiguration`, and the root is pending on-chain and not
 *    expired: `application-ready` with every confirmation in, else
 *    `application-in-signing`.
 * 2. The root is pending on-chain and not expired - still in its delay, or
 *    ready to apply: `pending-application`.
 * 3. A queued `requestConfiguration`: `configuration-in-signing`. This also
 *    covers requesting an expired, applied or invalidated root again.
 * 4. The root is pending on-chain, but its window has closed: `expired`.
 * 5. Stored in CGW, and nothing on-chain or queued: `draft`.
 *
 * Anything else - an applied or invalidated root, say - is not pending.
 */
@Injectable()
export class GuardConfigurationMapper {
  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly safePolicyGuardDecoder: SafePolicyGuardDecoder,
  ) {}

  /**
   * @param args.roots The Safe's configuration roots, from the indexer.
   * @param args.stored The configurations CGW stored for the Safe.
   * @param args.bindings The Safe's current guard policy bindings.
   * @param args.expiries `EXPIRY` in seconds, per guard address.
   * @param args.types The requested policy types.
   * @param args.now Unix seconds.
   */
  public map(args: {
    safe: SafeRef;
    transactions: ReadonlyArray<MultisigTransaction>;
    roots: ReadonlyArray<PolicyIndexerConfigurationRoot>;
    stored: ReadonlyArray<StoredPolicyConfiguration>;
    bindings: ReadonlyArray<PolicyIndexerSafePolicy>;
    expiries: ReadonlyMap<Address, number>;
    types: ReadonlyArray<PolicyType>;
    now: number;
  }): Array<PendingGuardConfiguration> {
    const facts = this.rootFacts({
      ...args,
      knownGuards: [
        ...getSafePolicyGuardDeployments(args.safe.chainId),
        ...args.roots.map((root) => root.guard),
        ...args.bindings.map((binding) => binding.guard),
      ],
    });

    return facts.flatMap((fact) => {
      const item = this.mapRoot({
        safe: args.safe,
        fact,
        expiries: args.expiries,
        now: args.now,
      });

      return item && this.isRequested({ item, ...args }) ? [item] : [];
    });
  }

  /**
   * Gathers, per root, what the indexer, the store and the queue say about it.
   */
  private rootFacts(args: {
    transactions: ReadonlyArray<MultisigTransaction>;
    roots: ReadonlyArray<PolicyIndexerConfigurationRoot>;
    stored: ReadonlyArray<StoredPolicyConfiguration>;
    knownGuards: ReadonlyArray<Address>;
  }): Array<RootFacts> {
    const facts = new Map<string, RootFacts>();
    const factOf = (root: Hex): RootFacts => {
      const key = root.toLowerCase();
      let fact = facts.get(key);
      if (!fact) {
        fact = {
          root,
          onChain: null,
          stored: null,
          request: null,
          apply: null,
        };
        facts.set(key, fact);
      }
      return fact;
    };

    for (const onChain of args.roots) {
      factOf(onChain.root).onChain = onChain;
    }

    for (const stored of args.stored) {
      factOf(stored.root).stored = stored;
    }

    // The queue is in nonce order, so the first call for a root is the one
    // that executes first.
    for (const transaction of args.transactions) {
      for (const call of queuedCalls(transaction, this.multiSendDecoder)) {
        if (!args.knownGuards.some((guard) => isAddressEqual(guard, call.to))) {
          continue;
        }

        const request = this.decodeRequest(call.data);
        if (request) {
          const fact = factOf(request);
          fact.request ??= {
            guard: call.to,
            transaction: pendingTransactionOf(transaction),
          };
          continue;
        }

        const configurations = this.decodeApply(call.data);
        if (configurations) {
          const fact = factOf(configurationRoot(configurations));
          fact.apply ??= {
            guard: call.to,
            configurations,
            transaction: pendingTransactionOf(transaction),
          };
        }
      }
    }

    return Array.from(facts.values());
  }

  /**
   * The item for one root, or `null` when the root is not pending.
   */
  private mapRoot(args: {
    safe: SafeRef;
    fact: RootFacts;
    expiries: ReadonlyMap<Address, number>;
    now: number;
  }): PendingGuardConfiguration | null {
    const { fact } = args;
    const window = this.applicationWindow(fact.onChain, args.expiries);
    const isApplicable = window !== null && args.now < window.expiresAt;
    const configurations =
      fact.apply?.configurations ?? fact.stored?.configurations ?? null;
    const createdAt =
      this.unixSeconds(fact.stored?.createdAt) ??
      fact.request?.transaction.proposedAt ??
      fact.apply?.transaction.proposedAt ??
      null;

    const item = (
      status: PendingGuardConfiguration['status'],
      details: Pick<
        PendingGuardConfiguration,
        'guard' | 'readyAt' | 'expiresAt' | 'transaction'
      >,
    ): PendingGuardConfiguration => ({
      kind: 'guard-configuration',
      status,
      safe: args.safe,
      configureRoot: fact.root,
      configurations,
      createdAt,
      ...details,
    });

    if (window && isApplicable && fact.apply) {
      const { transaction } = fact.apply;
      return item(
        transaction.confirmations >= transaction.confirmationsRequired
          ? PendingGuardConfigurationStatus.ApplicationReady
          : PendingGuardConfigurationStatus.ApplicationInSigning,
        { ...window, transaction },
      );
    }

    if (window && isApplicable) {
      return item(PendingGuardConfigurationStatus.PendingApplication, {
        ...window,
        transaction: null,
      });
    }

    if (fact.request) {
      return item(PendingGuardConfigurationStatus.ConfigurationInSigning, {
        guard: fact.request.guard,
        readyAt: null,
        expiresAt: null,
        transaction: fact.request.transaction,
      });
    }

    if (window) {
      return item(PendingGuardConfigurationStatus.Expired, {
        ...window,
        transaction: null,
      });
    }

    if (fact.stored && !fact.onChain && !fact.apply) {
      return item(PendingGuardConfigurationStatus.Draft, {
        guard: null,
        readyAt: null,
        expiresAt: null,
        transaction: null,
      });
    }

    return null;
  }

  /**
   * When a pending root becomes and stops being applicable, or `null` when it
   * is not pending.
   */
  private applicationWindow(
    onChain: PolicyIndexerConfigurationRoot | null,
    expiries: ReadonlyMap<Address, number>,
  ): { guard: Address; readyAt: number; expiresAt: number } | null {
    if (onChain?.status !== 'PENDING') {
      return null;
    }

    const expiry = expiries.get(onChain.guard);
    if (expiry === undefined) {
      return null;
    }

    return {
      guard: onChain.guard,
      readyAt: onChain.readyAt,
      expiresAt: onChain.readyAt + expiry,
    };
  }

  /**
   * Whether the item may set a requested policy type.
   *
   * An item is left out only when CGW knows the type of every configuration and
   * none was requested. A configuration of an unknown type - an unknown policy
   * contract, or configurations CGW does not hold - cannot be ruled out, so it
   * keeps the item in.
   */
  private isRequested(args: {
    item: PendingGuardConfiguration;
    safe: SafeRef;
    bindings: ReadonlyArray<PolicyIndexerSafePolicy>;
    types: ReadonlyArray<PolicyType>;
  }): boolean {
    if (!args.item.configurations) {
      return true;
    }

    return args.item.configurations.some((configuration) => {
      const type = this.policyTypeOf({ configuration, ...args });
      return type === null || args.types.includes(type);
    });
  }

  /**
   * The policy type a configuration sets. A configuration that removes a
   * policy names no policy contract, so its type is that of the binding it
   * removes.
   */
  private policyTypeOf(args: {
    configuration: PolicyConfiguration;
    safe: SafeRef;
    bindings: ReadonlyArray<PolicyIndexerSafePolicy>;
  }): PolicyType | null {
    const { configuration } = args;

    if (!isAddressEqual(configuration.policy, zeroAddress)) {
      return getPolicyTypeOfContract(args.safe.chainId, configuration.policy);
    }

    const operation = configuration.operation === 0 ? 'CALL' : 'DELEGATECALL';
    const binding = args.bindings.find(
      (binding) =>
        isAddressEqual(binding.target, configuration.target) &&
        binding.selector.toLowerCase() ===
          configuration.selector.toLowerCase() &&
        binding.operation === operation,
    );

    return binding ? guardPolicyTypeOfKind(binding.kind) : null;
  }

  /** The root of a `requestConfiguration` call, or `null` for other data. */
  private decodeRequest(data: Hex): Hex | null {
    if (!this.safePolicyGuardDecoder.helpers.isRequestConfiguration(data)) {
      return null;
    }

    try {
      const decoded = this.safePolicyGuardDecoder.decodeFunctionData({ data });
      return decoded.functionName === 'requestConfiguration'
        ? decoded.args[0]
        : null;
    } catch {
      return null;
    }
  }

  /** The configurations of an `applyConfiguration` call, or `null`. */
  private decodeApply(data: Hex): Array<PolicyConfiguration> | null {
    if (!this.safePolicyGuardDecoder.helpers.isApplyConfiguration(data)) {
      return null;
    }

    try {
      const decoded = this.safePolicyGuardDecoder.decodeFunctionData({ data });
      if (decoded.functionName !== 'applyConfiguration') {
        return null;
      }

      const parsed = z
        .array(PolicyConfigurationSchema)
        .nonempty()
        .safeParse(decoded.args[0]);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private unixSeconds(date: Date | undefined): number | null {
    return date ? Math.floor(date.getTime() / 1000) : null;
  }
}
