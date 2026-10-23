// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, type Hex, isAddressEqual, zeroAddress } from 'viem';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import type {
  DelayedPolicyChange,
  QueuedPolicyChangeConfigurationCall,
  ResolvedStatus,
} from '#/modules/policies/domain/entities/delayed-policy-change.entity';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerGuardEnforcedPolicy,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  type PendingDelayedGuardPolicies,
  PendingDelayedGuardPoliciesStatus,
  type PendingTransaction,
} from '#/modules/policies/domain/entities/pending-policy.entity';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { policyOperationFromValue } from '#/modules/policies/domain/entities/policy-operation.entity';
import type { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafePolicyGuardConfiguration } from '#/modules/policies/domain/entities/safe-policy-guard-configuration.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import {
  getPolicyTypeOfContract,
  getSafePolicyGuardDeployments,
} from '#/modules/policies/domain/policy-deployments.constants';
import {
  applicationWindowOf,
  createdAtOf,
  guardPolicyTypeOfKind,
  isRootApplicable,
  queuedApplyStatus,
} from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import {
  decodeConfigurations,
  pendingTransactionOf,
  type QueuedCallContext,
  queuedCalls,
} from '#/modules/policies/domain/utils/queued-calls.utils';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';

/**
 * Aggregates three sources of data and builds {Array<PendingDelayedGuardPolicies>}.
 * The configuration root is the key all three share, so items are grouped by it.
 * - The chain has the root (a hash of the configurations), its status and its application window, but not
 * the configurations.
 * - CGW has the configurations.
 * - The transaction queue has the request and apply calls not yet
 * executed.
 *
 * Where the sources overlap, the status follows the step closest to running
 * on chain, since that is what the client acts on: a queued apply on an open
 * window, else the open window, else a queued request, else an expired
 * window, else a draft that never reached the chain. A fully signed apply is
 * still `pending-application` before `readyAt`, because the guard rejects it
 * until then. An expired root is reported rather than dropped, so a lapsed
 * change does not vanish.
 */
@Injectable()
export class DelayedGuardPoliciesMapper {
  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly safePolicyGuardDecoder: SafePolicyGuardDecoder,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * @param args.guard The Safe's current transaction guard.
   * @param args.moduleGuard The Safe's current module guard.
   * @param args.onChainConfigurations The Safe's configuration roots as the
   * chain holds them, read from the indexer.
   * @param args.storedConfigurations The configurations behind those roots,
   * as CGW stored them when the wallet drafted them.
   * @param args.guardEnforcedPolicies The Safe's current guard policy bindings.
   * @param args.types The requested policy types.
   * @param args.now Unix seconds.
   */
  public map(args: {
    safe: SafeRef;
    guard: Address | null;
    moduleGuard: Address | null;
    transactions: ReadonlyArray<MultisigTransaction>;
    onChainConfigurations: ReadonlyArray<PolicyIndexerConfigurationRoot>;
    storedConfigurations: ReadonlyArray<SafePolicyGuardConfiguration>;
    guardEnforcedPolicies: ReadonlyArray<PolicyIndexerGuardEnforcedPolicy>;
    types: ReadonlyArray<PolicyType>;
    now: number;
  }): Array<PendingDelayedGuardPolicies> {
    const knownGuards = [
      ...getSafePolicyGuardDeployments(args.safe.chainId),
      ...args.onChainConfigurations.map((root) => root.guard),
      ...args.guardEnforcedPolicies.map((binding) => binding.guard),
    ];

    const queuedPolicyChanges = this.findQueuedConfigurationRequestOrApplyCalls(
      {
        safe: args.safe,
        transactions: args.transactions,
        knownGuards,
      },
    );

    const changes = this.changesByGuardAndRoot({
      enabledGuards: [args.guard, args.moduleGuard].filter(
        (guard): guard is Address =>
          guard !== null && !isAddressEqual(guard, zeroAddress),
      ),
      onChainConfigurations: args.onChainConfigurations,
      storedConfigurations: args.storedConfigurations,
      queued: queuedPolicyChanges,
    });

    return changes.flatMap((change) => {
      const item = this.toItem({ change, safe: args.safe, now: args.now });
      const wanted =
        item &&
        this.maySetRequestedType({
          item,
          safe: args.safe,
          bindings: args.guardEnforcedPolicies,
          types: args.types,
        });
      return wanted ? [item] : [];
    });
  }

  /**
   * Merges the three sources into one change per guard and root.
   *
   * A root on chain is kept only for a guard currently set on the Safe: a
   * guard the Safe has moved away from still holds its pending roots, but
   * applying them changes nothing the Safe enforces. A queued call is the
   * Safe's own next step, so it is kept on whichever guard it targets.
   *
   * CGW stores configurations per Safe and root, not per guard, so they
   * belong to every change with their root; with no such change they are a
   * draft.
   */
  private changesByGuardAndRoot(args: {
    enabledGuards: ReadonlyArray<Address>;
    onChainConfigurations: ReadonlyArray<PolicyIndexerConfigurationRoot>;
    storedConfigurations: ReadonlyArray<SafePolicyGuardConfiguration>;
    queued: ReadonlyArray<QueuedPolicyChangeConfigurationCall>;
  }): Array<DelayedPolicyChange> {
    // Roots are lower-cased by every source; guards are compared the same way.
    const changes = new Map<string, DelayedPolicyChange>();
    const changeOf = (guard: Address, root: Hex): DelayedPolicyChange => {
      const key = `${guard.toLowerCase()}:${root}`;
      let change = changes.get(key);
      if (!change) {
        change = {
          guard,
          root,
          onChain: null,
          stored: null,
          queuedRequest: null,
          queuedApply: null,
        };
        changes.set(key, change);
      }
      return change;
    };

    for (const onChain of args.onChainConfigurations) {
      if (
        args.enabledGuards.some((guard) => isAddressEqual(guard, onChain.guard))
      ) {
        changeOf(onChain.guard, onChain.root).onChain = onChain;
      }
    }

    // The queue is in nonce order, so the first call for a change executes
    // first.
    for (const call of args.queued) {
      const change = changeOf(call.guard, call.root);
      if (call.kind === 'request') {
        change.queuedRequest ??= call;
      } else {
        change.queuedApply ??= call;
      }
    }

    const drafts: Array<DelayedPolicyChange> = [];
    for (const stored of args.storedConfigurations) {
      const withRoot = [...changes.values()].filter(
        (change) => change.root === stored.root,
      );
      for (const change of withRoot) {
        change.stored = stored;
      }
      if (withRoot.length === 0) {
        drafts.push({
          guard: null,
          root: stored.root,
          onChain: null,
          stored,
          queuedRequest: null,
          queuedApply: null,
        });
      }
    }

    return [...changes.values(), ...drafts];
  }

  /**
   * The `requestConfiguration` and `applyConfiguration` calls queued on a known
   * guard, in queue order. A call is found directly or one level inside a
   * MultiSend batch.
   */
  private findQueuedConfigurationRequestOrApplyCalls(args: {
    safe: SafeRef;
    transactions: ReadonlyArray<MultisigTransaction>;
    knownGuards: ReadonlyArray<Address>;
  }): Array<QueuedPolicyChangeConfigurationCall> {
    return args.transactions.flatMap((transaction) => {
      const context = {
        chainId: args.safe.chainId,
        safeTxHash: transaction.safeTxHash,
      };

      return queuedCalls({
        chainId: args.safe.chainId,
        transaction,
        multiSendDecoder: this.multiSendDecoder,
      })
        .filter((call) =>
          args.knownGuards.some((guard) => isAddressEqual(guard, call.to)),
        )
        .flatMap((call) => {
          const decoded = this.decodeConfigurationRequestOrApplyCall({
            call,
            transaction: pendingTransactionOf(transaction),
            context,
          });
          return decoded ? [decoded] : [];
        });
    });
  }

  /** The item for one change, or `null` when the change is not pending. */
  private toItem(args: {
    change: DelayedPolicyChange;
    safe: SafeRef;
    now: number;
  }): PendingDelayedGuardPolicies | null {
    const resolved = this.resolveStatus(args.change, args.now);
    if (!resolved) {
      return null;
    }

    const { change } = args;
    return {
      kind: 'delayed-guard-policies',
      safe: args.safe,
      root: change.root,
      // A queued apply carries the configurations in its calldata. Otherwise
      // only CGW's copy can say what the root stands for.
      configurations:
        change.queuedApply?.configurations ??
        change.stored?.configurations ??
        null,
      createdAt: createdAtOf(change),
      ...resolved,
    };
  }

  /**
   * The precedence from the class doc, first match wins. `null` when the
   * change is finished: applied or invalidated, with nothing queued.
   */
  private resolveStatus(
    change: DelayedPolicyChange,
    now: number,
  ): ResolvedStatus | null {
    const { onChain, queuedRequest, queuedApply } = change;
    const window = applicationWindowOf(onChain);
    const openWindow =
      onChain && isRootApplicable(onChain, now) ? window : null;

    // The apply is the next step; its signatures and the delay decide.
    if (openWindow && queuedApply) {
      return {
        status: queuedApplyStatus(queuedApply, openWindow, now),
        ...openWindow,
        transaction: queuedApply.transaction,
      };
    }

    // The window is open and the wallet has yet to queue the apply.
    if (openWindow) {
      return {
        status: PendingDelayedGuardPoliciesStatus.PendingApplication,
        ...openWindow,
        transaction: null,
      };
    }

    // No open window, so the queued request is what opens one.
    if (queuedRequest) {
      return {
        status: PendingDelayedGuardPoliciesStatus.ConfigurationInSigning,
        guard: queuedRequest.guard,
        readyAt: null,
        expiresAt: null,
        transaction: queuedRequest.transaction,
      };
    }

    // Pending on chain but past `expiresAt`: it has to be requested again.
    if (window) {
      return {
        status: PendingDelayedGuardPoliciesStatus.Expired,
        ...window,
        transaction: null,
      };
    }

    // Only CGW knows the change: the wallet saved it and went no further.
    if (change.stored && !onChain && !queuedApply) {
      return {
        status: PendingDelayedGuardPoliciesStatus.Draft,
        guard: null,
        readyAt: null,
        expiresAt: null,
        transaction: null,
      };
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
  private maySetRequestedType(args: {
    item: PendingDelayedGuardPolicies;
    safe: SafeRef;
    bindings: ReadonlyArray<PolicyIndexerGuardEnforcedPolicy>;
    types: ReadonlyArray<PolicyType>;
  }): boolean {
    if (!args.item.configurations) {
      return true;
    }

    return args.item.configurations.some((configuration) => {
      const type = this.policyTypeOf({
        configuration,
        safe: args.safe,
        bindings: args.bindings,
      });
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

  /**
   * The `requestConfiguration` or `applyConfiguration` a queued call is, or
   * `null` for any other call.
   *
   * A call whose selector matches but whose arguments do not decode is a
   * malformed queued transaction: it cannot be reported, so it is skipped and
   * logged.
   */
  private decodeConfigurationRequestOrApplyCall(args: {
    call: { to: Address; data: Hex };
    transaction: PendingTransaction;
    context: QueuedCallContext;
  }): QueuedPolicyChangeConfigurationCall | null {
    const { to: guard, data } = args.call;
    const { helpers } = this.safePolicyGuardDecoder;
    const isRequest = helpers.isRequestConfiguration(data);
    const isApply = helpers.isApplyConfiguration(data);
    if (!(isRequest || isApply)) {
      return null;
    }

    try {
      if (isRequest) {
        const decoded = this.safePolicyGuardDecoder.decodeFunctionData({
          data,
        });
        if (decoded.functionName !== 'requestConfiguration') {
          return null;
        }
        return {
          kind: 'request',
          root: decoded.args[0],
          guard,
          transaction: args.transaction,
        };
      }

      const configurations = decodeConfigurations({
        decoder: this.safePolicyGuardDecoder,
        data,
        functionName: 'applyConfiguration',
      });
      if (!configurations) {
        return null;
      }
      return {
        kind: 'apply',
        root: configurationRoot(configurations),
        guard,
        configurations,
        transaction: args.transaction,
      };
    } catch (error) {
      this.loggingService.debug({
        message: 'Could not decode a queued SafePolicyGuard configuration call',
        ...args.context,
        error: asError(error).message,
      });
      return null;
    }
  }
}
