// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { IDelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { IDelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import { DelegateApiVersion } from '@/modules/policies/domain/entities/delegate-api-version.entity';
import type {
  PolicyIndexerSafeAllowance,
  PolicyIndexerSafePolicy,
} from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import { GuardPolicyMapper } from '@/modules/policies/routes/mappers/guard-policy.mapper';
import {
  type DelegatesOfVersion,
  ProposerMapper,
} from '@/modules/policies/routes/mappers/proposer.mapper';
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
  authPayload: AuthPayload;
};

@Injectable()
export class PoliciesService {
  constructor(
    @Inject(IPolicyIndexerRepository)
    private readonly policyIndexerRepository: IPolicyIndexerRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesV2Repository: IDelegatesV2Repository,
    @Inject(IDelegatesV3Repository)
    private readonly delegatesV3Repository: IDelegatesV3Repository,
    private readonly spendingLimitMapper: SpendingLimitMapper,
    private readonly proposerMapper: ProposerMapper,
    private readonly guardPolicyMapper: GuardPolicyMapper,
  ) {}

  /**
   * The policies in effect on every Safe of the Space, in one request.
   * `safes` narrows that set of Safes from the Space - it can only ever be a subset.
   */
  public async getSpaceActivePolicies(
    request: SpacePolicyRequest,
  ): Promise<Array<ActivePolicy>> {
    const spaceSafes = await this.spaceSafes(request);

    return await this.resolveActivePolicies(spaceSafes);
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
   * One indexer read covers all of them; the per-Safe reads that follow - what
   * the Safe itself has switched on, and who may propose on it - run one at a
   * time, to stay under the Transaction Service's concurrency limit. All of it
   * or nothing: a page whose purpose is saying what controls a set of Safes must
   * not answer "nothing" where the answer is "unknown".
   */
  private async resolveActivePolicies(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<Array<ActivePolicy>> {
    if (safes.length === 0) {
      return [];
    }

    // One upstream read at a time, rather than one `Promise.all` covering every
    // Safe. This is to avoid 429 errors.
    //
    const state = await this.policyIndexerRepository.getState({ safes });

    const policies: Array<ActivePolicy> = [];

    for (const safe of safes) {
      const { enabledModules, transactionGuard } = await this.enforcers(safe);
      const delegatesByVersion = await this.delegatesByVersion(safe);

      policies.push(
        ...this.spendingLimitMapper.map({
          safe,
          allowances: this.getAllowancesBySafe(state.allowances, safe),
          enabledModules,
        }),
        ...this.proposerMapper.map({ safe, delegatesByVersion }),
        ...this.guardPolicyMapper.map({
          safe,
          policies: this.getPoliciesBySafe(state.policies, safe),
          transactionGuard,
        }),
      );
    }

    return policies;
  }

  /**
   * The addresses registered as delegates of the Safe - what a proposer grant
   * is - from each delegates API, kept apart rather than merged so the response
   * can say which API holds a grant.
   *
   * Read at the Transaction Service's maximum page size: its default page would
   * silently truncate a Safe with many proposers, and a policies page that
   * under-reports who may propose is worse than none.
   */
  private async delegatesByVersion(
    safe: SafeRef,
  ): Promise<Array<DelegatesOfVersion>> {
    const args = {
      chainId: safe.chainId,
      safeAddress: safe.address,
      limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
    };

    // Sequential for the same reason as the loop in `resolveActivePolicies`:
    // while the Queue Service is switched off both repositories call the very
    // same Transaction Service endpoint, so issuing them together is two
    // concurrent requests to one rate-limited host.
    const v2 = await this.delegatesV2Repository.getDelegates(args);
    const v3 = await this.delegatesV3Repository.getDelegates(args);

    return [
      { version: DelegateApiVersion.V2, delegates: v2.results },
      { version: DelegateApiVersion.V3, delegates: v3.results },
    ];
  }

  /**
   * What the Safe itself has switched on: the modules it has enabled and the
   * guard it has set. Both are what turn a configured policy into an enforced
   * one.
   *
   * Read from the Safe rather than the indexer: enablement lives in the Safe's
   * own storage, and CGW already serves it.
   */
  private async enforcers(safe: SafeRef): Promise<{
    enabledModules: Array<Address>;
    transactionGuard: Address | null;
  }> {
    const { modules, guard } = await this.safeRepository.getSafe({
      chainId: safe.chainId,
      address: safe.address,
    });

    return { enabledModules: modules ?? [], transactionGuard: guard };
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

  /**
   * The guard bindings belonging to {@link safe}.
   *
   * Scoped for the same reason as {@link getAllowancesBySafe}: one read covers
   * every Safe of a request.
   */
  private getPoliciesBySafe(
    policies: ReadonlyArray<PolicyIndexerSafePolicy>,
    safe: SafeRef,
  ): Array<PolicyIndexerSafePolicy> {
    return policies.filter(
      (policy) =>
        policy.chainId === safe.chainId &&
        isAddressEqual(policy.safe, safe.address),
    );
  }
}
