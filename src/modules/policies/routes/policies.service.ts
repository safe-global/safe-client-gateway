// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import type {
  PolicyIndexerSafeAllowance,
  PolicyIndexerSafePolicy,
} from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { IPolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository.interface';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';
import type {
  CreatePolicyConfigurationRequestPayload,
  CreatePolicyConfigurationRequestResponse,
} from '@/modules/policies/routes/entities/create-policy-configuration-request.dto.entity';
import { GuardPolicyMapper } from '@/modules/policies/routes/mappers/guard-policy.mapper';
import { SpendingLimitMapper } from '@/modules/policies/routes/mappers/spending-limit.mapper';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/domain/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import type { Caip10Address } from '@/validation/entities/schemas/caip-10-addresses.schema';

type PolicyRequest = {
  spaceId: Space['id'];
  safeId: Caip10Address;
  authPayload: AuthPayload;
};

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
    @Inject(IPolicyConfigurationRequestsRepository)
    private readonly configurationRequestsRepository: IPolicyConfigurationRequestsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    private readonly spendingLimitMapper: SpendingLimitMapper,
    private readonly guardPolicyMapper: GuardPolicyMapper,
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
   * One indexer read covers all of them, and the Safe reads that say what the
   * Safe itself has switched on run concurrently. All of it or nothing: a page whose
   * purpose is saying what controls a set of Safes must not answer "nothing"
   * where the answer is "unknown".
   */
  private async resolveActivePolicies(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<Array<ActivePolicy>> {
    if (safes.length === 0) {
      return [];
    }

    const [state, enforcers] = await Promise.all([
      this.policyIndexerRepository.getState({ safes }),
      Promise.all(safes.map((safe) => this.enforcers(safe))),
    ]);

    const policies: Array<ActivePolicy> = [];

    for (const [index, safe] of safes.entries()) {
      const { enabledModules, transactionGuard } = enforcers[index];

      policies.push(
        ...this.spendingLimitMapper.map({
          safe,
          allowances: this.getAllowancesBySafe(state.allowances, safe),
          enabledModules,
        }),
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
    const isInSpace = safes.some((safe) =>
      this.compareSafes(safe, request.safeId),
    );

    if (!isInSpace) {
      throw new NotFoundException('Safe not found in this space');
    }
  }
}
