// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, type Hex, isAddressEqual, zeroAddress } from 'viem';
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerGuardEnforcedPolicy,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  type PendingGuardConfiguration,
  PendingGuardConfigurationStatus,
  type PendingTransaction,
} from '#/modules/policies/domain/entities/pending-policy.entity';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { policyOperationFromValue } from '#/modules/policies/domain/entities/policy-operation.entity';
import type { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import type { StoredPolicyConfiguration } from '#/modules/policies/domain/entities/stored-policy-configuration.entity';
import {
  getPolicyTypeOfContract,
  getSafePolicyGuardDeployments,
} from '#/modules/policies/domain/policy-deployments.constants';
import {
  guardPolicyTypeOfKind,
  isRootApplicable,
} from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import {
  decodeConfigurations,
  pendingTransactionOf,
  type QueuedCallContext,
  queuedCalls,
} from '#/modules/policies/routes/mappers/queued-calls.utils';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';

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
 * The first matching rule decides its status, where "not expired" means
 * `now < expiresAt`:
 *
 * 1. A queued `applyConfiguration`, the root pending and not expired, fewer
 *    confirmations than required: `application-in-signing`.
 * 2. The same, fully signed, before `readyAt`: `pending-application`.
 * 3. The same, fully signed, from `readyAt`: `application-ready`.
 * 4. The root pending and not expired, no queued apply: `pending-application`.
 * 5. A queued `requestConfiguration`, whatever the on-chain state and however
 *    many confirmations: `configuration-in-signing`.
 * 6. The root pending and `now >= expiresAt`: `expired`.
 * 7. Stored in CGW, no on-chain root and nothing queued: `draft`.
 *
 * Anything else - an applied or invalidated root, say - is not pending.
 */
@Injectable()
export class GuardConfigurationMapper {
  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly safePolicyGuardDecoder: SafePolicyGuardDecoder,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * @param args.roots The Safe's configuration roots, from the indexer.
   * @param args.stored The configurations CGW stored for the Safe.
   * @param args.bindings The Safe's current guard policy bindings.
   * @param args.types The requested policy types.
   * @param args.now Unix seconds.
   */
  public map(args: {
    safe: SafeRef;
    transactions: ReadonlyArray<MultisigTransaction>;
    roots: ReadonlyArray<PolicyIndexerConfigurationRoot>;
    stored: ReadonlyArray<StoredPolicyConfiguration>;
    bindings: ReadonlyArray<PolicyIndexerGuardEnforcedPolicy>;
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
        now: args.now,
      });

      return item && this.isRequested({ item, ...args }) ? [item] : [];
    });
  }

  /**
   * Gathers, per root, what the indexer, the store and the queue say about it.
   */
  private rootFacts(args: {
    safe: SafeRef;
    transactions: ReadonlyArray<MultisigTransaction>;
    roots: ReadonlyArray<PolicyIndexerConfigurationRoot>;
    stored: ReadonlyArray<StoredPolicyConfiguration>;
    knownGuards: ReadonlyArray<Address>;
  }): Array<RootFacts> {
    // Roots are lower-cased by every source: the indexer schema, viem and CGW.
    const facts = new Map<Hex, RootFacts>();
    const factOf = (root: Hex): RootFacts => {
      let fact = facts.get(root);
      if (!fact) {
        fact = {
          root,
          onChain: null,
          stored: null,
          request: null,
          apply: null,
        };
        facts.set(root, fact);
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
      const context = {
        chainId: args.safe.chainId,
        safeTxHash: transaction.safeTxHash,
      };
      for (const call of queuedCalls(transaction, this.multiSendDecoder)) {
        if (!args.knownGuards.some((guard) => isAddressEqual(guard, call.to))) {
          continue;
        }

        const request = this.decodeRequest(call.data, context);
        if (request) {
          const fact = factOf(request);
          fact.request ??= {
            guard: call.to,
            transaction: pendingTransactionOf(transaction),
          };
          continue;
        }

        const configurations = this.decodeApply(call.data, context);
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
    now: number;
  }): PendingGuardConfiguration | null {
    const { fact } = args;
    const window =
      fact.onChain?.status === 'PENDING'
        ? {
            guard: fact.onChain.guard,
            readyAt: fact.onChain.readyAt,
            expiresAt: fact.onChain.expiresAt,
          }
        : null;
    // The window while the root can still be applied.
    const applicable =
      fact.onChain && isRootApplicable(fact.onChain, args.now) ? window : null;
    const configurations =
      fact.apply?.configurations ?? fact.stored?.configurations ?? null;
    const createdAt =
      (fact.stored && toSecondsTimestamp(fact.stored.createdAt)) ??
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
      root: fact.root,
      configurations,
      createdAt,
      ...details,
    });

    if (applicable && fact.apply) {
      const { transaction } = fact.apply;
      const isSigned =
        transaction.confirmations >= transaction.confirmationsRequired;
      if (!isSigned) {
        return item(PendingGuardConfigurationStatus.ApplicationInSigning, {
          ...applicable,
          transaction,
        });
      }
      // The guard rejects an apply until `readyAt`, however signed.
      return item(
        args.now >= applicable.readyAt
          ? PendingGuardConfigurationStatus.ApplicationReady
          : PendingGuardConfigurationStatus.PendingApplication,
        { ...applicable, transaction },
      );
    }

    if (applicable) {
      return item(PendingGuardConfigurationStatus.PendingApplication, {
        ...applicable,
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
    bindings: ReadonlyArray<PolicyIndexerGuardEnforcedPolicy>;
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
    bindings: ReadonlyArray<PolicyIndexerGuardEnforcedPolicy>;
  }): PolicyType | null {
    const { configuration } = args;

    if (!isAddressEqual(configuration.policy, zeroAddress)) {
      return getPolicyTypeOfContract(args.safe.chainId, configuration.policy);
    }

    const operation = policyOperationFromValue(configuration.operation);
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
  private decodeRequest(data: Hex, context: QueuedCallContext): Hex | null {
    if (!this.safePolicyGuardDecoder.helpers.isRequestConfiguration(data)) {
      return null;
    }

    try {
      const decoded = this.safePolicyGuardDecoder.decodeFunctionData({ data });
      return decoded.functionName === 'requestConfiguration'
        ? decoded.args[0]
        : null;
    } catch (error) {
      this.logUndecodable(error, context);
      return null;
    }
  }

  /** The configurations of an `applyConfiguration` call, or `null`. */
  private decodeApply(
    data: Hex,
    context: QueuedCallContext,
  ): Array<PolicyConfiguration> | null {
    if (!this.safePolicyGuardDecoder.helpers.isApplyConfiguration(data)) {
      return null;
    }

    try {
      return decodeConfigurations({
        decoder: this.safePolicyGuardDecoder,
        data,
        functionName: 'applyConfiguration',
      });
    } catch (error) {
      this.logUndecodable(error, context);
      return null;
    }
  }

  /**
   * A call whose selector matched but whose arguments do not decode cannot be
   * reported, so it is skipped - and logged, since it means a malformed queued
   * transaction.
   */
  private logUndecodable(error: unknown, context: QueuedCallContext): void {
    this.loggingService.debug({
      message: 'Could not decode a queued SafePolicyGuard configuration call',
      ...context,
      error: asError(error).message,
    });
  }
}
