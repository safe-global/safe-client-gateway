// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, type Hex, isAddressEqual, zeroAddress } from 'viem';
import { z } from 'zod';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeGuardManagerDecoder } from '@/modules/policies/domain/contracts/decoders/safe-guard-manager-decoder.helper';
import { SafePolicyGuardDecoder } from '@/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import {
  type PendingGuardSetup,
  type PendingGuardSetupChange,
  PendingGuardSetupChangeKind,
  PendingGuardSetupStatus,
} from '@/modules/policies/domain/entities/pending-policy.entity';
import {
  type PolicyConfiguration,
  PolicyConfigurationSchema,
} from '@/modules/policies/domain/entities/policy-configuration.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { getSafePolicyGuardDeployments } from '@/modules/policies/domain/policy-deployments.constants';
import {
  pendingTransactionOf,
  queuedCalls,
} from '@/modules/policies/routes/mappers/queued-calls.utils';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';

/**
 * The Safe's two guard slots. `null` means the slot is empty.
 */
type GuardSlots = { guard: Address | null; moduleGuard: Address | null };

/**
 * Finds the queued transactions that set up the `SafePolicyGuard` of a Safe:
 * `configureImmediately` on a known guard, and `setGuard` / `setModuleGuard`
 * calls that install, replace or remove one.
 *
 * Calls are found directly or one level inside a MultiSend batch, like the
 * spending-limit changes are.
 */
@Injectable()
export class GuardSetupMapper {
  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly safePolicyGuardDecoder: SafePolicyGuardDecoder,
    private readonly safeGuardManagerDecoder: SafeGuardManagerDecoder,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * One item per queued transaction that holds at least one setup call.
   *
   * @param args.guard The Safe's current transaction guard.
   * @param args.moduleGuard The Safe's current module guard.
   */
  public map(args: {
    safe: SafeRef;
    guard: Address | null;
    moduleGuard: Address | null;
    transactions: ReadonlyArray<MultisigTransaction>;
  }): Array<PendingGuardSetup> {
    const knownGuards = getSafePolicyGuardDeployments(args.safe.chainId);

    return args.transactions.flatMap((transaction) => {
      const item = this.mapTransaction({
        safe: args.safe,
        transaction,
        knownGuards,
        // Every transaction runs against the Safe's current slots: the queue
        // executes one transaction at a time, and an earlier one may never run.
        slots: {
          guard: this.slotValue(args.guard),
          moduleGuard: this.slotValue(args.moduleGuard),
        },
      });

      return item ? [item] : [];
    });
  }

  private mapTransaction(args: {
    safe: SafeRef;
    transaction: MultisigTransaction;
    knownGuards: ReadonlyArray<Address>;
    slots: GuardSlots;
  }): PendingGuardSetup | null {
    const changes: Array<PendingGuardSetupChange> = [];

    // Calls run in calldata order, so the slots are carried forward: a
    // `setGuard` early in a batch decides whether a later
    // `configureImmediately` reverts.
    for (const call of queuedCalls(args.transaction, this.multiSendDecoder)) {
      const change = isAddressEqual(call.to, args.safe.address)
        ? this.guardSetterChange({
            data: call.data,
            knownGuards: args.knownGuards,
            slots: args.slots,
          })
        : this.configureImmediatelyChange({
            call,
            knownGuards: args.knownGuards,
            slots: args.slots,
          });

      if (change) {
        changes.push(change);
      }
    }

    if (changes.length === 0) {
      return null;
    }

    const transaction = pendingTransactionOf(args.transaction);

    return {
      kind: 'guard-setup',
      status:
        transaction.confirmations >= transaction.confirmationsRequired
          ? PendingGuardSetupStatus.Ready
          : PendingGuardSetupStatus.InSigning,
      safe: args.safe,
      changes,
      transaction,
    };
  }

  /**
   * A `setGuard` or `setModuleGuard` call on the Safe, reported when the old or
   * the new value is a known `SafePolicyGuard`. Moves {@link args.slots}
   * forward either way.
   */
  private guardSetterChange(args: {
    data: Hex;
    knownGuards: ReadonlyArray<Address>;
    slots: GuardSlots;
  }): PendingGuardSetupChange | null {
    const isSetGuard = this.safeGuardManagerDecoder.helpers.isSetGuard(
      args.data,
    );
    const isSetModuleGuard =
      this.safeGuardManagerDecoder.helpers.isSetModuleGuard(args.data);

    if (!(isSetGuard || isSetModuleGuard)) {
      return null;
    }

    let newValue: Address;
    try {
      const decoded = this.safeGuardManagerDecoder.decodeFunctionData({
        data: args.data,
      });
      [newValue] = decoded.args;
    } catch (error) {
      this.logUndecodable(error);
      return null;
    }

    const slot = isSetGuard ? 'guard' : 'moduleGuard';
    const from = args.slots[slot];
    const to = this.slotValue(newValue);
    args.slots[slot] = to;

    if (
      !(
        this.isKnownGuard(from, args.knownGuards) ||
        this.isKnownGuard(to, args.knownGuards)
      )
    ) {
      return null;
    }

    return isSetGuard
      ? { kind: PendingGuardSetupChangeKind.SetGuard, from, to }
      : { kind: PendingGuardSetupChangeKind.SetModuleGuard, from, to };
  }

  /**
   * A `configureImmediately` call on a known `SafePolicyGuard`.
   *
   * The guard rejects it with `GuardAlreadyEnabled` once it sits in either slot
   * of the Safe, which is what `willRevert` reports.
   */
  private configureImmediatelyChange(args: {
    call: { to: Address; data: Hex };
    knownGuards: ReadonlyArray<Address>;
    slots: GuardSlots;
  }): PendingGuardSetupChange | null {
    if (
      !(
        this.isKnownGuard(args.call.to, args.knownGuards) &&
        this.safePolicyGuardDecoder.helpers.isConfigureImmediately(
          args.call.data,
        )
      )
    ) {
      return null;
    }

    const configurations = this.decodeConfigurations(args.call.data);
    if (!configurations) {
      return null;
    }

    const guard = args.call.to;

    return {
      kind: PendingGuardSetupChangeKind.ConfigureImmediately,
      guard,
      configurations,
      willRevert:
        this.isSameAddress(args.slots.guard, guard) ||
        this.isSameAddress(args.slots.moduleGuard, guard),
    };
  }

  /**
   * The configurations a `configureImmediately` call passes, or `null` when
   * they do not decode - an `operation` outside CALL/DELEGATECALL, say, which
   * the guard would reject anyway.
   */
  private decodeConfigurations(data: Hex): Array<PolicyConfiguration> | null {
    try {
      const decoded = this.safePolicyGuardDecoder.decodeFunctionData({ data });
      if (decoded.functionName !== 'configureImmediately') {
        return null;
      }

      const [configurations] = decoded.args;
      const parsed = z
        .array(PolicyConfigurationSchema)
        .safeParse(configurations);

      return parsed.success ? parsed.data : null;
    } catch (error) {
      this.logUndecodable(error);
      return null;
    }
  }

  /** A guard slot's value, with the zero address read as an empty slot. */
  private slotValue(address: Address | null): Address | null {
    return address && !isAddressEqual(address, zeroAddress) ? address : null;
  }

  private isKnownGuard(
    address: Address | null,
    knownGuards: ReadonlyArray<Address>,
  ): boolean {
    return knownGuards.some((guard) => this.isSameAddress(address, guard));
  }

  private isSameAddress(a: Address | null, b: Address): boolean {
    return a !== null && isAddressEqual(a, b);
  }

  /**
   * A call whose selector matched but whose arguments do not decode cannot be
   * reported, so it is skipped - and logged, since it means a malformed queued
   * transaction.
   */
  private logUndecodable(error: unknown): void {
    this.loggingService.debug({
      message: 'Could not decode a queued SafePolicyGuard setup call',
      error: asError(error).message,
    });
  }
}
