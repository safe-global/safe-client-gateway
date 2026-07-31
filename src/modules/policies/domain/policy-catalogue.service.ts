// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type {
  AvailablePolicy,
  PolicyCatalogueEntry,
} from '@/modules/policies/domain/entities/available-policy.entity';
import {
  guardEnforcement,
  moduleEnforcement,
  type PolicyEnforcement,
} from '@/modules/policies/domain/entities/policy-enforcement.entity';
import { PolicyEnforcementKind } from '@/modules/policies/domain/entities/policy-type.entity';
import { POLICY_CATALOGUE } from '@/modules/policies/domain/policy-catalogue.constants';
import { PolicyDeploymentsService } from '@/modules/policies/domain/policy-deployments.service';

/**
 * Builds the policy catalogue for a chain.
 *
 * The catalogue itself is static ({@link POLICY_CATALOGUE}); this service only
 * resolves what depends on the chain, which is the deployment addresses. It
 * depends on nothing per Safe, so the response is the same for every Safe of a
 * chain.
 */
@Injectable()
export class PolicyCatalogueService {
  constructor(private readonly deployments: PolicyDeploymentsService) {}

  public get(chainId: string): Array<AvailablePolicy> {
    return POLICY_CATALOGUE.map((entry) => ({
      type: entry.type,
      title: entry.title,
      description: entry.description,
      available: entry.available,
      isFallback: entry.isFallback,
      enforcement: this.resolveEnforcement(chainId, entry),
    }));
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

    const policyContract = this.deployments.getPolicyContract(
      chainId,
      entry.type,
    );

    if (!policyContract) {
      return null;
    }

    // Assumption: the policies modelled today are transaction-guard enforced.
    // TODO(WA-2914): populate `moduleGuard` once a policy type is enforced in
    // the module guard slot; the slot a *configured* policy occupies is
    // resolved per Safe in `PoliciesService`.
    return guardEnforcement({
      transactionGuard: {
        policyContract,
        safePolicyGuard: this.deployments.getSafePolicyGuard(chainId),
      },
    });
  }
}
