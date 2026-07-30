// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Address } from 'viem';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type {
  ActivePolicy,
  PendingPolicy,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type { AvailablePolicy } from '@/modules/policies/domain/entities/available-policy.entity';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { guardEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import {
  type PolicyType,
  policyTypeFromContractName,
} from '@/modules/policies/domain/entities/policy-type.entity';
import { IPoliciesRepository } from '@/modules/policies/domain/policies.repository.interface';
import { PolicyCatalogueService } from '@/modules/policies/domain/policy-catalogue.service';
import {
  type AddressNames,
  type PolicyResolver,
  type ResolvedPolicy,
} from '@/modules/policies/domain/resolvers/policy-resolver.interface';
import { POLICY_RESOLVERS } from '@/modules/policies/policies.constants';
import type { SafeId } from '@/modules/policies/routes/entities/safe-id.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

type PolicyRequest = {
  spaceId: Space['id'];
  safeId: SafeId;
  authPayload: AuthPayload;
};

const MILLISECONDS_IN_SECOND = 1000;

@Injectable()
export class PoliciesService {
  constructor(
    @Inject(IPoliciesRepository)
    private readonly policiesRepository: IPoliciesRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IAddressBookItemsRepository)
    private readonly addressBookItemsRepository: IAddressBookItemsRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    private readonly policyCatalogueService: PolicyCatalogueService,
    @Inject(POLICY_RESOLVERS)
    private readonly resolvers: ReadonlyArray<PolicyResolver>,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * The policy types the Safe can configure, with the deployment addresses that
   * would enforce them and how many of each are already active.
   */
  public async getAvailablePolicies(
    request: PolicyRequest,
  ): Promise<{ items: Array<AvailablePolicy> }> {
    await this.assertSafeInSpace(request);

    const active = await this.resolveActivePolicies(request);

    return {
      items: await this.policyCatalogueService.get({
        chainId: request.safeId.chainId,
        configuredCounts: this.countByType(active),
      }),
    };
  }

  /**
   * The policies currently set on the Safe.
   */
  public async getActivePolicies(
    request: PolicyRequest,
  ): Promise<{ items: Array<ActivePolicy> }> {
    await this.assertSafeInSpace(request);

    return { items: await this.resolveActivePolicies(request) };
  }

  /**
   * Configuration changes requested through the guard's delayed path that are
   * still waiting out the delay (or ready to be applied).
   */
  public async getPendingPolicies(
    request: PolicyRequest,
  ): Promise<{ items: Array<PendingPolicy> }> {
    await this.assertSafeInSpace(request);

    const rootRequests = await this.policiesRepository.getOpenRootRequests({
      chainId: request.safeId.chainId,
      safeAddress: request.safeId.address,
    });
    const now = Date.now();

    return {
      items: rootRequests.map((rootRequest) => ({
        configureRoot: rootRequest.root,
        requestedAt: toUnixSeconds(rootRequest.timestamp),
        // The `RootConfigured` event carries `block.timestamp + DELAY`, so the
        // ready time is authoritative and needs no `DELAY()` read.
        readyAt: toUnixSeconds(rootRequest.validFrom),
        isReady: rootRequest.validFrom.getTime() <= now,
        policy: null,
      })),
    };
  }

  private async resolveActivePolicies(
    request: PolicyRequest,
  ): Promise<Array<ActivePolicy>> {
    const { chainId, address: safeAddress } = request.safeId;

    const [confirmations, safe, names] = await Promise.all([
      this.policiesRepository.getActiveConfirmations({ chainId, safeAddress }),
      this.safeRepository.getSafe({ chainId, address: safeAddress }),
      this.getAddressNames(request),
    ]);

    const byType = this.groupByPolicyType({ chainId, confirmations });

    const resolved = await Promise.all(
      this.resolvers.map((resolver) =>
        resolver.resolve({
          chainId,
          confirmations: byType.get(resolver.type) ?? [],
          names,
        }),
      ),
    );

    return resolved
      .flat()
      .map((policy) => this.toActivePolicy({ policy, safe }));
  }

  /**
   * Splits the confirmations by policy type.
   *
   * The type comes from the `policyType` the Transaction Service resolved for
   * the policy address through its `PolicyContract` registry - the single source
   * of truth. CGW keeps no address map to type against, so a chain cannot be
   * missing an entry and there is nothing to drift.
   *
   * A policy CGW does not model (`DenyPolicy`, `MultiSendPolicy`, …) or that the
   * registry could not name is skipped and logged: rendering an unknown
   * restriction is worse than omitting it.
   */
  private groupByPolicyType(args: {
    chainId: string;
    confirmations: Array<PolicyConfirmation>;
  }): Map<PolicyType, Array<PolicyConfirmation>> {
    const byType = new Map<PolicyType, Array<PolicyConfirmation>>();

    for (const confirmation of args.confirmations) {
      const type = policyTypeFromContractName(confirmation.policyType);

      if (!type) {
        this.loggingService.warn({
          message: 'Unmodelled policy type, skipping the policy',
          chainId: args.chainId,
          safe: confirmation.safe,
          policy: confirmation.policy,
          policyType: confirmation.policyType,
        });
        continue;
      }

      byType.set(type, [...(byType.get(type) ?? []), confirmation]);
    }

    return byType;
  }

  /**
   * Attaches the Safe-level facts a resolver cannot know: which guard slot
   * enforces the policy, and whether that guard is enabled on the Safe.
   *
   * A policy configured through `configureImmediately` before the guard was set
   * is reported with `enabled: false` rather than hidden, so the wallet can ask
   * the user to enable the guard.
   */
  private toActivePolicy(args: {
    policy: ResolvedPolicy;
    safe: Safe;
  }): ActivePolicy {
    // Every source of one item shares the guard and policy contract; they only
    // differ in the access they cover.
    const [source] = args.policy.sources;
    const isTransactionGuard = isSameAddress(args.safe.guard, source.guard);

    return {
      id: args.policy.id,
      type: args.policy.type,
      // TODO(WA-2914): the module guard slot cannot be read yet - the
      // Transaction Service's single-Safe endpoint does not return
      // `moduleGuard`. Guard-enforced policies are therefore reported in the
      // transaction guard slot, which is the slot the modelled policies use.
      enforcement: guardEnforcement({
        transactionGuard: {
          policyContract: source.policy,
          safePolicyGuard: source.guard,
        },
      }),
      enabled: isTransactionGuard,
      data: args.policy.data,
    };
  }

  private countByType(
    policies: Array<ActivePolicy>,
  ): Partial<Record<PolicyType, number>> {
    const counts: Partial<Record<PolicyType, number>> = {};

    for (const policy of policies) {
      counts[policy.type] = (counts[policy.type] ?? 0) + 1;
    }

    return counts;
  }

  /**
   * Names of the space address book that apply to the Safe's chain, keyed by
   * lower-cased address.
   */
  private async getAddressNames(request: PolicyRequest): Promise<AddressNames> {
    const items = await this.addressBookItemsRepository.findAllBySpaceId({
      authPayload: request.authPayload,
      spaceId: request.spaceId,
    });

    return new Map(
      items
        .filter((item) => item.chainIds.includes(request.safeId.chainId))
        .map((item) => [item.address.toLowerCase(), item.name]),
    );
  }

  /**
   * The caller must be an active member of the space, and the Safe must belong
   * to it - otherwise a member could read the policy state of any Safe through
   * a space they happen to belong to.
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
        isSameAddress(safe.address, request.safeId.address),
    );

    if (!isInSpace) {
      throw new NotFoundException('Safe not found in this space');
    }
  }
}

function isSameAddress(first: Address, second: Address): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / MILLISECONDS_IN_SECOND);
}
