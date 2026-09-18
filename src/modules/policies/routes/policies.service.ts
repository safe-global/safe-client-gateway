// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
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
    private readonly spendingLimitMapper: SpendingLimitMapper,
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
   * One indexer read covers all of them, and the Safe reads that say whether a
   * module is enabled run concurrently. All of it or nothing: a page whose
   * purpose is saying what controls a set of Safes must not answer "nothing"
   * where the answer is "unknown".
   */
  private async resolveActivePolicies(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<Array<ActivePolicy>> {
    if (safes.length === 0) {
      return [];
    }

    const [state, enabledModules] = await Promise.all([
      this.policyIndexerRepository.getState({ safes }),
      Promise.all(safes.map((safe) => this.enabledModules(safe))),
    ]);

    const policies: Array<ActivePolicy> = [];

    for (const [index, safe] of safes.entries()) {
      policies.push(
        ...this.spendingLimitMapper.map({
          safe,
          allowances: this.getAllowancesBySafe(state.allowances, safe),
          enabledModules: enabledModules[index],
        }),
      );
    }

    return policies;
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
