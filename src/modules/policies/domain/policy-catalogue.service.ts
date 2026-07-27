// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';
import type {
  AvailablePolicy,
  PolicyCatalogueEntry,
} from '@/modules/policies/domain/entities/available-policy.entity';
import {
  guardEnforcement,
  moduleEnforcement,
  type PolicyEnforcement,
} from '@/modules/policies/domain/entities/policy-enforcement.entity';
import {
  PolicyEnforcementKind,
  type PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import {
  FF_POLICIES,
  POLICY_CATALOGUE,
} from '@/modules/policies/domain/policy-catalogue.constants';
import { PolicyDeploymentsService } from '@/modules/policies/domain/policy-deployments.service';

/**
 * Builds the policy catalogue for a chain.
 *
 * The catalogue itself is static ({@link POLICY_CATALOGUE}); this service only
 * resolves what depends on the chain (deployment addresses, availability) and
 * on the Safe (`configuredCount`).
 */
@Injectable()
export class PolicyCatalogueService {
  constructor(
    private readonly deployments: PolicyDeploymentsService,
    @Inject(IFeatureFlagService)
    private readonly featureFlagService: IFeatureFlagService,
  ) {}

  /**
   * @param args.configuredCounts - active policies per type for the Safe. A
   * missing type counts as `0`, so callers may pass a partial map.
   */
  public async get(args: {
    chainId: string;
    configuredCounts: Partial<Record<PolicyType, number>>;
  }): Promise<Array<AvailablePolicy>> {
    const isFeatureEnabled = await this.featureFlagService.isFeatureEnabled(
      args.chainId,
      FF_POLICIES,
    );

    return POLICY_CATALOGUE.map((entry) => {
      const enforcement = this.resolveEnforcement(args.chainId, entry);

      return {
        type: entry.type,
        title: entry.title,
        description: entry.description,
        // A policy is only offered when the feature is on for the chain *and*
        // CGW can name the contracts that would enforce it.
        available: isFeatureEnabled && enforcement !== null,
        configuredCount: args.configuredCounts[entry.type] ?? 0,
        enforcement,
      };
    });
  }

  private resolveEnforcement(
    chainId: string,
    entry: PolicyCatalogueEntry,
  ): PolicyEnforcement | null {
    if (entry.enforcementKind === PolicyEnforcementKind.Module) {
      const moduleAddress = this.deployments.getModuleAddress(
        chainId,
        entry.type,
      );
      return moduleAddress ? moduleEnforcement(moduleAddress) : null;
    }

    const safePolicyGuard = this.deployments.getSafePolicyGuard(chainId);
    const policyContract = this.deployments.getPolicyContract(
      chainId,
      entry.type,
    );

    if (!(safePolicyGuard && policyContract)) {
      return null;
    }

    // Assumption: the policies modelled today are transaction-guard enforced.
    // TODO(WA-2914): populate `moduleGuard` once a policy type is enforced in
    // the module guard slot; the slot a *configured* policy occupies is
    // resolved per Safe in `PoliciesService`.
    return guardEnforcement({
      transactionGuard: { policyContract, safePolicyGuard },
    });
  }
}
