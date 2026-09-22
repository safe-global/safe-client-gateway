// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import chunk from 'lodash/chunk';
import { type Address, isAddressEqual } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { IDelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
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
  private readonly delegatesBatchSize: number;

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
    private readonly spendingLimitMapper: SpendingLimitMapper,
    private readonly proposerMapper: ProposerMapper,
  ) {
    this.delegatesBatchSize = this.configurationService.getOrThrow<number>(
      'policies.delegates.batchSize',
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
    const delegatesPerSafe = proposersRequested
      ? await this.delegatesPerSafe(safes)
      : null;

    const policies: Array<ActivePolicy> = [];

    for (const [index, safe] of safes.entries()) {
      if (state) {
        const enabledModules = await this.enabledModules(safe);

        policies.push(
          ...this.spendingLimitMapper.map({
            safe,
            allowances: this.getAllowancesBySafe(state.allowances, safe),
            enabledModules,
          }),
        );
      }

      if (delegatesPerSafe) {
        policies.push(
          ...this.proposerMapper.map({
            safe,
            delegates: delegatesPerSafe[index],
          }),
        );
      }
    }

    return policies;
  }

  /**
   * The delegates of every Safe of {@link safes}, index-aligned with it.
   *
   * The Safes are independent reads, so they go out concurrently rather than
   * one at a time. Concurrency is capped at `policies.delegates.batchSize`.
   *
   * {@link resolveActivePolicies} already had.
   */
  private async delegatesPerSafe(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<Array<Array<Delegate>>> {
    const batches: Array<Array<Array<Delegate>>> = [];

    for (const batch of chunk(safes, this.delegatesBatchSize)) {
      batches.push(
        await Promise.all(batch.map((safe) => this.delegates(safe))),
      );
    }

    return batches.flat();
  }

  /**
   * The addresses registered as delegates of the Safe - what a proposer grant
   * is.
   *
   * Read at the Transaction Service's maximum page size: its default page would
   * silently truncate a Safe with many proposers, and a policies page that
   * under-reports who may propose is worse than none.
   */
  private async delegates(safe: SafeRef): Promise<Array<Delegate>> {
    const { results } = await this.delegatesV3Repository.getDelegates({
      chainId: safe.chainId,
      safeAddress: safe.address,
      limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
    });

    return results;
  }

  /**
   * The modules the Safe has enabled, which is what turns a configured
   * module policy into an enforced one.
   *
   * Read from the Safe rather than the indexer: enablement lives in the Safe's
   * own storage, and CGW already serves it.
   */
  private async enabledModules(safe: SafeRef): Promise<Array<Address>> {
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
