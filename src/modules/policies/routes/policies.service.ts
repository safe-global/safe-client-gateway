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
import { IPolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository.interface';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';
import { policyStateForSafe } from '@/modules/policies/domain/utils/policy-state.utils';
import { POLICY_ASSEMBLERS } from '@/modules/policies/policies.constants';
import type {
  CreatePolicyConfigurationRequestPayload,
  CreatePolicyConfigurationRequestResponse,
} from '@/modules/policies/routes/entities/create-policy-configuration-request.dto.entity';
import type { SafeId } from '@/modules/policies/routes/entities/safe-id.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

type PolicyRequest = {
  spaceId: Space['id'];
  safeId: SafeId;
  authPayload: AuthPayload;
};

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
    @Inject(IPolicyConfigurationRequestsRepository)
    private readonly configurationRequestsRepository: IPolicyConfigurationRequestsRepository,
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
   * Stores the `Configuration[]` behind a delayed configuration request.
   *
   * `requestConfiguration(bytes32 root)` publishes only the hash, while
   * `applyConfiguration` needs the configurations themselves, so between the two
   * calls the payload exists nowhere on-chain. Storing it here is what lets any
   * client of the Safe - not only the one that requested the configuration -
   * apply it, or say what it changes.
   *
   * The wallet stores it *before* requesting the configuration on-chain, so a row
   * is deliberately accepted for a root the Safe has not requested yet.
   *
   * What keeps that safe is the one check that does not depend on chain state:
   * the root is recomputed from the submitted configurations and has to match.
   * A row therefore always describes the configurations that hash to its own
   * root, so no row can misdescribe a real request.
   *
   * Idempotent, so a client retry cannot duplicate.
   */
  public async createConfigurationRequest(
    request: PolicyRequest & {
      payload: CreatePolicyConfigurationRequestPayload;
    },
  ): Promise<CreatePolicyConfigurationRequestResponse> {
    const userId = getAuthenticatedUserIdOrFail(request.authPayload);
    await this.assertSafeInSpace(request);

    const { chainId, address: safeAddress } = request.safeId;
    const { configurations } = request.payload;

    // The recomputed root is what is stored, so a row is keyed by the canonical
    // lower-case hash rather than by whatever casing the client sent. Storing
    // the submitted string instead would let a retry in another casing insert a
    // second row for the same request - past the unique constraint, and into the
    // per-Safe cap.
    const root = configurationRoot(configurations);

    if (root !== request.payload.root.toLowerCase()) {
      throw new UnprocessableEntityException(
        'The configurations do not hash to the given root',
      );
    }

    await this.configurationRequestsRepository.create({
      chainId,
      safeAddress,
      root,
      configurations,
      spaceId: request.spaceId,
      createdBy: userId,
    });

    return { configureRoot: root };
  }

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

    const [state, enforcers] = await Promise.all([
      this.policyIndexerRepository.getState({ safes }),
      Promise.all(safes.map((safe) => this.enforcers(safe))),
    ]);
    const now = Math.floor(Date.now() / MILLISECONDS_IN_SECOND);

    return safes.map((safe, index) => {
      const context = {
        safe,
        state: policyStateForSafe(state, safe),
        ...enforcers[index],
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
   * The caller must be an active member of the space, and the Safe must belong
   * to it - otherwise a member could write against any Safe through a space they
   * happen to belong to.
   */
  private async assertSafeInSpace(request: PolicyRequest): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(request.authPayload);
    await assertMember(this.membersRepository, request.spaceId, userId);

    const safes = await this.spaceSafesRepository.findBySpaceId(
      request.spaceId,
    );
    const isInSpace = safes.some(
      (safe) =>
        safe.chainId === request.safeId.chainId &&
        safe.address.toLowerCase() === request.safeId.address.toLowerCase(),
    );

    if (!isInSpace) {
      throw new NotFoundException('Safe not found in this space');
    }
  }
}
