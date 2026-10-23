// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, type Hex, isAddressEqual } from 'viem';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import {
  type PendingImmediateGuardPolicies,
  PendingImmediateGuardPoliciesStatus,
} from '#/modules/policies/domain/entities/pending-policy.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import {
  decodeConfigurations,
  pendingTransactionOf,
  queuedCalls,
} from '#/modules/policies/domain/utils/queued-calls.utils';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';

/**
 * Finds the queued `configureImmediately` calls on a known `SafePolicyGuard`:
 * policies bound without a delay, before the guard is enabled on the Safe.
 * One item per call, found directly or one level inside a MultiSend batch.
 */
@Injectable()
export class ImmediateGuardPoliciesMapper {
  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly safePolicyGuardDecoder: SafePolicyGuardDecoder,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public map(args: {
    safe: SafeRef;
    transactions: ReadonlyArray<MultisigTransaction>;
  }): Array<PendingImmediateGuardPolicies> {
    const knownGuards = getSafePolicyGuardDeployments(args.safe.chainId);

    return args.transactions.flatMap((transaction) =>
      queuedCalls({
        chainId: args.safe.chainId,
        transaction,
        multiSendDecoder: this.multiSendDecoder,
      }).flatMap((call) => {
        const item = this.mapCall({
          safe: args.safe,
          transaction,
          call,
          knownGuards,
        });
        return item ? [item] : [];
      }),
    );
  }

  private mapCall(args: {
    safe: SafeRef;
    transaction: MultisigTransaction;
    call: { to: Address; data: Hex };
    knownGuards: ReadonlyArray<Address>;
  }): PendingImmediateGuardPolicies | null {
    if (
      !(
        args.knownGuards.some((guard) => isAddressEqual(guard, args.call.to)) &&
        this.safePolicyGuardDecoder.helpers.isConfigureImmediately(
          args.call.data,
        )
      )
    ) {
      return null;
    }

    let configurations: PendingImmediateGuardPolicies['configurations'] | null;
    try {
      configurations = decodeConfigurations({
        decoder: this.safePolicyGuardDecoder,
        data: args.call.data,
        functionName: 'configureImmediately',
      });
    } catch (error) {
      this.loggingService.debug({
        message: 'Could not decode a queued configureImmediately call',
        chainId: args.safe.chainId,
        safeTxHash: args.transaction.safeTxHash,
        error: asError(error).message,
      });
      return null;
    }
    if (!configurations) {
      return null;
    }

    const transaction = pendingTransactionOf(args.transaction);

    return {
      kind: 'immediate-guard-policies',
      status:
        transaction.confirmations >= transaction.confirmationsRequired
          ? PendingImmediateGuardPoliciesStatus.Ready
          : PendingImmediateGuardPoliciesStatus.InSigning,
      safe: args.safe,
      guard: args.call.to,
      configurations,
      transaction,
    };
  }
}
