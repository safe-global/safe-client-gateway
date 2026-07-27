// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getAllowanceModuleDeployments } from '@/domain/common/utils/deployments';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  type PolicyDeployment,
  type PolicyDeployments,
  PolicyDeploymentsSchema,
} from '@/modules/policies/domain/entities/policy-deployment.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { POLICY_DEPLOYMENTS } from '@/modules/policies/domain/policy-deployments.constants';

/**
 * Single accessor for the policy-engine contract deployments.
 *
 * Resolution order per chain:
 * 1. the `POLICY_ENGINE_DEPLOYMENTS` configuration override, if it holds an
 *    entry for the chain (an override *replaces* the built-in entry, it is not
 *    merged into it, so a partial override cannot leave a stale address behind)
 * 2. {@link POLICY_DEPLOYMENTS}
 *
 * Module-enforced deployments that a Safe deployments package can answer for
 * are resolved from the package instead of from either source, so they cannot
 * drift.
 */
@Injectable()
export class PolicyDeploymentsService {
  private readonly deployments: PolicyDeployments;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.deployments = this.buildDeployments();
  }

  /**
   * Whether guard-enforced policies can be configured on the chain, i.e.
   * whether a `SafePolicyGuard` deployment is known for it.
   */
  public isSupportedChain(chainId: string): boolean {
    return this.getDeployment(chainId) !== null;
  }

  public getDeployment(chainId: string): PolicyDeployment | null {
    return this.deployments[chainId] ?? null;
  }

  public getSafePolicyGuard(chainId: string): Address | null {
    return this.getDeployment(chainId)?.safePolicyGuard ?? null;
  }

  /**
   * Address of the policy contract implementing {@link type} on {@link chainId},
   * or `null` when the chain has no such deployment.
   */
  public getPolicyContract(chainId: string, type: PolicyType): Address | null {
    const deployment = this.getDeployment(chainId);
    if (!deployment) return null;
    if (type === PolicyType.Erc20Transfer || type === PolicyType.Cosigner) {
      return deployment.policyContracts[type] ?? null;
    }
    return null;
  }

  /**
   * Reverse lookup of {@link getPolicyContract}: which policy type a policy
   * address implements. `null` for an unknown deployment, which is how a policy
   * CGW cannot type is detected.
   */
  public getPolicyType(chainId: string, policy: Address): PolicyType | null {
    const deployment = this.getDeployment(chainId);
    if (!deployment) return null;

    const entry = Object.entries(deployment.policyContracts).find(
      ([, address]) => address?.toLowerCase() === policy.toLowerCase(),
    );

    return entry ? (entry[0] as PolicyType) : null;
  }

  /**
   * Address of the module enforcing {@link type} on {@link chainId}, or `null`
   * when unknown - which is what makes a module-enforced policy unavailable.
   */
  public getModuleAddress(chainId: string, type: PolicyType): Address | null {
    if (type === PolicyType.SpendingLimit) {
      // Authoritative source; never duplicated in POLICY_DEPLOYMENTS.
      const [allowanceModule] = getAllowanceModuleDeployments({ chainId });
      return allowanceModule ?? null;
    }

    if (type === PolicyType.Recovery) {
      return (
        this.getDeployment(chainId)?.moduleAddresses[PolicyType.Recovery] ??
        null
      );
    }

    return null;
  }

  private buildDeployments(): PolicyDeployments {
    const override = this.configurationService.get<string>(
      'policies.deployments',
    );

    if (!override) {
      return POLICY_DEPLOYMENTS;
    }

    const parsed = PolicyDeploymentsSchema.safeParse(this.parseJson(override));

    if (!parsed.success) {
      // A malformed override must not take the service down: fall back to the
      // built-in deployments and make the misconfiguration visible.
      this.loggingService.error({
        message: 'Invalid POLICY_ENGINE_DEPLOYMENTS, ignoring the override',
        error: parsed.error.message,
      });
      return POLICY_DEPLOYMENTS;
    }

    return { ...POLICY_DEPLOYMENTS, ...parsed.data };
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
