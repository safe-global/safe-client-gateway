// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Address } from 'viem';
import type { Page } from '@/domain/entities/page.entity';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { PolicyAssembler } from '@/modules/policies/domain/assemblers/policy-assembler.interface';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import { policyStateForSafe } from '@/modules/policies/domain/utils/policy-state.utils';
import { POLICY_ASSEMBLERS } from '@/modules/policies/policies.constants';
import type { SafeId } from '@/modules/policies/routes/entities/safe-id.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

type SpacePolicyRequest = {
  spaceId: Space['id'];
  /** Narrows the read to a subset of the Space's Safes. */
  safes?: ReadonlyArray<SafeId>;
  authPayload: AuthPayload;
};

/** An active policy plus the Safe it applies to. */
export type SpaceActivePolicy = ActivePolicy & { safe: SafeRef };

const MILLISECONDS_IN_SECOND = 1000;

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
    @Inject(POLICY_ASSEMBLERS)
    private readonly assemblers: ReadonlyArray<PolicyAssembler>,
  ) {}

  /**
   * The policies in effect on every Safe of the Space, in one request.
   *
   * The Space names the set, so nothing has to be passed in: the caller's
   * membership is checked against this Space, and the Space's Safes *are* the
   * query. `safes` narrows that set - it can only ever be a subset, so this
   * never becomes a cross-Safe read of Safes the caller has no claim on.
   */
  public async getSpaceActivePolicies(
    request: SpacePolicyRequest,
  ): Promise<Page<SpaceActivePolicy>> {
    const spaceSafes = await this.spaceSafes(request);
    const resolved = await this.resolveActivePolicies(spaceSafes);
    const results = resolved.flatMap(({ safe, policies }) =>
      policies.map((policy) => ({ ...policy, safe })),
    );

    // Unpaginated for now: a Space holds at most a handful of Safes, so the
    // whole set fits one response. The envelope is the paginated one so adding
    // a cursor later is not a breaking change.
    return { count: results.length, next: null, previous: null, results };
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

    const inSpace = await this.spaceSafesRepository.findBySpaceId(
      request.spaceId,
    );
    const all = inSpace.map((safe) => ({
      chainId: safe.chainId,
      address: safe.address,
    }));

    if (!request.safes) {
      return all;
    }

    return request.safes.map((requested) => {
      const match = all.find(
        (safe) =>
          safe.chainId === requested.chainId &&
          safe.address.toLowerCase() === requested.address.toLowerCase(),
      );

      if (!match) {
        throw new UnprocessableEntityException(
          `Safe ${requested.chainId}:${requested.address} is not in this space`,
        );
      }

      return match;
    });
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
  ): Promise<Array<{ safe: SafeRef; policies: Array<ActivePolicy> }>> {
    if (safes.length === 0) {
      return [];
    }

    const [state, enabledModules] = await Promise.all([
      this.policyIndexerRepository.getState({ safes }),
      Promise.all(safes.map((safe) => this.enabledModules(safe))),
    ]);
    const now = Math.floor(Date.now() / MILLISECONDS_IN_SECOND);

    return safes.map((safe, index) => {
      const context = {
        safe,
        state: policyStateForSafe(state, safe),
        enabledModules: enabledModules[index],
        now,
      };

      return {
        safe,
        policies: this.assemblers.flatMap((assembler) =>
          assembler.assemble(context),
        ),
      };
    });
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
}
