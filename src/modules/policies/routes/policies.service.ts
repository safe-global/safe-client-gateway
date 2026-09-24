// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import chunk from 'lodash/chunk';
import {
  SAFE_QUEUE_SERVICE_MAX_LIMIT,
  SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
} from '@/domain/common/constants';
import { batched } from '@/domain/common/utils/batch';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { IDelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PendingPolicy } from '@/modules/policies/domain/entities/pending-policy.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import { PendingSpendingLimitMapper } from '@/modules/policies/routes/mappers/pending-spending-limit.mapper';
import { ProposerMapper } from '@/modules/policies/routes/mappers/proposer.mapper';
import { SpendingLimitMapper } from '@/modules/policies/routes/mappers/spending-limit.mapper';

import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/domain/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import type { Caip10Address } from '@/validation/entities/schemas/caip-10-addresses.schema';

type SpacePolicyRequest = {
  spaceId: Space['id'];
  /** Narrows the read to a subset of the Space's Safes. */
  safes?: ReadonlyArray<Caip10Address>;
  /** The policy types to report. Required: naming none asks for nothing. */
  types: ReadonlyArray<PolicyType>;
  authPayload: AuthPayload;
};

@Injectable()
export class PoliciesService {
  private readonly batchSize: number;
  private readonly pendingBatchSize: number;
  private readonly safeQueueServiceEnabled: boolean;

  constructor(
    @Inject(IPolicyIndexerRepository)
    private readonly policyIndexerRepository: IPolicyIndexerRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IDelegatesV3Repository)
    private readonly delegatesV3Repository: IDelegatesV3Repository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly spendingLimitMapper: SpendingLimitMapper,
    private readonly proposerMapper: ProposerMapper,
    private readonly pendingSpendingLimitMapper: PendingSpendingLimitMapper,
  ) {
    this.batchSize =
      this.configurationService.getOrThrow<number>('policies.batchSize');
    this.pendingBatchSize = this.configurationService.getOrThrow<number>(
      'policies.pending.batchSize',
    );
    this.safeQueueServiceEnabled =
      this.configurationService.getOrThrow<boolean>(
        'features.safeQueueService',
      );
  }

  /**
   * The policies in effect on every Safe of the Space, in one request.
   * `safes` narrows that set of Safes from the Space - it can only ever be a subset.
   */
  public async getSpaceActivePolicies(
    request: SpacePolicyRequest,
  ): Promise<Array<ActivePolicy>> {
    const spaceSafes = await this.spaceSafes(request);

    return await this.resolveActivePolicies(spaceSafes, request.types);
  }

  /**
   * The spending-limit changes sitting unexecuted in the queue of every Safe of the
   * Space, or the requested subset of them.
   */
  public async getSpacePendingPolicies(
    request: SpacePolicyRequest,
  ): Promise<Array<PendingPolicy>> {
    const spaceSafes = await this.spaceSafes(request);

    return await this.resolvePendingPolicies(spaceSafes, request.types);
  }

  /**
   * The Safes of the Space, or the requested subset of them.
   *
   * @throws {UnprocessableEntityException} when a requested Safe is not in the
   * Space - silently narrowing to nothing would look like a Space whose Safes
   * hold no policies.
   */
  private async spaceSafes(
    request: SpacePolicyRequest,
  ): Promise<Array<SafeRef>> {
    const userId = getAuthenticatedUserIdOrFail(request.authPayload);
    await assertMember(this.membersRepository, request.spaceId, userId);

    const safesInSpace = (
      await this.spaceSafesRepository.findBySpaceId(request.spaceId)
    ).map((safe) => ({
      chainId: safe.chainId,
      address: safe.address,
    }));

    const requested = request.safes;

    // If no specific Safes requested in Space, return all.
    if (!requested) {
      return safesInSpace;
    }

    const safeNotInSpace = requested.find(
      (requestedSafe) =>
        !safesInSpace.some((safe) => this.compareSafes(safe, requestedSafe)),
    );

    if (safeNotInSpace) {
      throw new UnprocessableEntityException(
        `Safe ${safeNotInSpace.chainId}:${safeNotInSpace.address} is not in this space`,
      );
    }

    // Narrowing filters the Space's own Safes rather than mapping the request,
    // so a Safe asked for twice - repeated outright, or in another casing - is
    // still read once and its policies reported once.
    return safesInSpace.filter((safe) =>
      requested.some((wanted) => this.compareSafes(safe, wanted)),
    );
  }

  private compareSafes(a: SafeRef, b: SafeRef): boolean {
    return a.chainId === b.chainId && isAddressEqual(a.address, b.address);
  }

  /**
   * The policies in effect on every Safe of {@link safes}.
   *
   * `types` is the set of policy types to report. The query parameter that
   * feeds it is required and rejects an empty value, so a caller wanting
   * everything names everything - which is why nothing here has to decide what
   * an unfiltered request would have meant.
   */
  private async resolveActivePolicies(
    safes: ReadonlyArray<SafeRef>,
    types: ReadonlyArray<PolicyType>,
  ): Promise<Array<ActivePolicy>> {
    const spendingLimitsRequested = types.includes(PolicyType.SpendingLimit);
    const proposersRequested = types.includes(PolicyType.Proposer);

    if (
      safes.length === 0 ||
      !(spendingLimitsRequested || proposersRequested)
    ) {
      return [];
    }

    const state = spendingLimitsRequested
      ? await this.policyIndexerRepository.getState({ safes })
      : null;
    const enabledModulesPerSafe = spendingLimitsRequested
      ? await this.enabledModulesPerSafe(safes)
      : null;
    const delegatesPerSafe = proposersRequested
      ? await this.delegatesPerSafe(safes)
      : null;

    const policies: Array<ActivePolicy> = [];

    for (const [index, safe] of safes.entries()) {
      if (state && enabledModulesPerSafe) {
        const enabledModules = enabledModulesPerSafe[index];

        // A Safe whose enabled modules could not be read is skipped.
        if (enabledModules) {
          policies.push(
            ...this.spendingLimitMapper.map({
              safe,
              allowances: this.getAllowancesBySafe(state.allowances, safe),
              enabledModules,
            }),
          );
        }
      }

      if (delegatesPerSafe) {
        const delegates = delegatesPerSafe[index];

        // A Safe whose delegates could not be read is skipped.
        if (delegates) {
          policies.push(...this.proposerMapper.map({ safe, delegates }));
        }
      }
    }

    return policies;
  }

  /**
   * The pending spending-limit changes of every Safe of {@link safes}.
   *
   * `spending-limit` is the only pending type detected today - a proposer grant is
   * off-chain and immediate, so it never has a queued state.
   */
  private async resolvePendingPolicies(
    safes: ReadonlyArray<SafeRef>,
    types: ReadonlyArray<PolicyType>,
  ): Promise<Array<PendingPolicy>> {
    if (safes.length === 0 || !types.includes(PolicyType.SpendingLimit)) {
      return [];
    }

    // The Queue Service has no `to` filter yet, so the full first page of the
    // queue is always read and decoded in-process - filtering only the
    // Transaction Service path would make coverage depend on
    // FF_SAFE_QUEUE_SERVICE.
    const queueLimit = this.safeQueueServiceEnabled
      ? SAFE_QUEUE_SERVICE_MAX_LIMIT
      : SAFE_TRANSACTION_SERVICE_MAX_LIMIT;

    const policies: Array<PendingPolicy> = [];

    for (const batch of chunk(safes, this.pendingBatchSize)) {
      const batchPolicies = await Promise.all(
        batch.map((safe) => this.pendingPoliciesForSafe(safe, queueLimit)),
      );
      policies.push(...batchPolicies.flat());
    }

    return policies;
  }

  /**
   * The pending spending-limit changes found in one Safe's transaction queue.
   */
  private async pendingPoliciesForSafe(
    safe: SafeRef,
    queueLimit: number,
  ): Promise<Array<PendingPolicy>> {
    const fullSafe = await this.safeRepository.getSafe({
      chainId: safe.chainId,
      address: safe.address,
    });
    const queue = await this.safeRepository.getTransactionQueue({
      chainId: safe.chainId,
      safe: fullSafe,
      limit: queueLimit,
    });

    return this.pendingSpendingLimitMapper.map({
      safe,
      transactions: queue.results,
    });
  }

  /**
   * The delegates of every Safe of {@link safes}, index-aligned with it.
   *
   * The Safes are independent reads, so they go out concurrently rather than
   * one at a time. Concurrency is capped at `policies.batchSize`. A Safe
   * whose delegates could not be read is reported as `null` rather than
   * failing the whole request - the caller skips just that Safe's proposer
   * policy instead.
   */
  private async delegatesPerSafe(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<Array<Array<Delegate> | null>> {
    const settled = await batched(safes, this.batchSize, (safe) =>
      this.delegates(safe),
    );

    return settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const safe = safes[index];
      this.loggingService.warn({
        message: 'Could not read delegates of a Safe',
        chainId: safe.chainId,
        safeAddress: safe.address,
        error: asError(result.reason).message,
      });
      return null;
    });
  }

  /**
   * The addresses registered as delegates of the Safe - what a proposer grant
   * is.
   *
   * Read at the Queue Service's max page size i.e 100. That limit is lower
   * than the Transaction Service i.e. 200.
   */
  private async delegates(safe: SafeRef): Promise<Array<Delegate>> {
    const { results } = await this.delegatesV3Repository.getDelegates({
      chainId: safe.chainId,
      safeAddress: safe.address,
      limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
    });

    return results;
  }

  /**
   * The enabled modules of every Safe of {@link safes}, index-aligned with it.
   *
   * Concurrency is capped at `policies.batchSize`. Unlike
   * {@link delegatesPerSafe}, a Safe whose modules could not be read is
   * reported as `null` rather than failing the whole request - the caller
   * skips just that Safe's spending-limit policies instead.
   */
  private async enabledModulesPerSafe(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<Array<ReadonlyArray<Address> | null>> {
    const settled = await batched(safes, this.batchSize, (safe) =>
      this.enabledModules(safe),
    );

    return settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const safe = safes[index];
      this.loggingService.warn({
        message: 'Could not read enabled modules of a Safe',
        chainId: safe.chainId,
        safeAddress: safe.address,
        error: asError(result.reason).message,
      });
      return null;
    });
  }

  /**
   * The modules the Safe has enabled, which is what turns a configured
   * module policy into an enforced one.
   *
   * Read from the Safe rather than the indexer: enablement lives in the Safe's
   * own storage, and CGW already serves it.
   */
  private async enabledModules(safe: SafeRef): Promise<ReadonlyArray<Address>> {
    const { modules } = await this.safeRepository.getSafe({
      chainId: safe.chainId,
      address: safe.address,
    });

    return modules ?? [];
  }

  /**
   * The allowance rows belonging to {@link safe}.
   *
   * One indexer read covers every Safe of a request, so an unscoped read would
   * report another Safe's policies on this one.
   */
  private getAllowancesBySafe(
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>,
    safe: SafeRef,
  ): Array<PolicyIndexerSafeAllowance> {
    return allowances.filter(
      (allowance) =>
        allowance.chainId === safe.chainId &&
        isAddressEqual(allowance.safe, safe.address),
    );
  }
}
