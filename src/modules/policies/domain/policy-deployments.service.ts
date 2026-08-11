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
import {
  isGuardPolicyType,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import { DEFAULT_POLICY_DEPLOYMENT } from '@/modules/policies/domain/policy-deployments.constants';

/**
 * Single accessor for the policy-engine contract deployments: the
 * `POLICY_ENGINE_DEPLOYMENTS` configuration, falling back to
 * {@link DEFAULT_POLICY_DEPLOYMENT} for a chain it does not list.
 *
 * Only the catalogue (`/policies`) needs them: it names the contract that *would*
 * enforce a policy type the Safe has not configured yet, which no indexed event
 * can answer for. The addresses of policies already configured on a Safe are
 * never read from here - they come from the Transaction Service, which indexes
 * `PolicyConfirmed` and is the source of truth for both the address and the
 * `policyType` behind it.
 *
 * Module-enforced deployments that a Safe deployments package can answer for are
 * resolved from the package instead, so they cannot drift.
 *
 * TODO(WA-2914): drop this too once the Transaction Service exposes its
 * `PolicyContract` registry, or safe-research/policy-engine publishes deployments
 * to a package CGW can read.
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
   * The deployment of {@link chainId}: its configured entry, or the default one.
   *
   * A configured chain is described by its entry alone rather than merged field
   * by field with the default, so "which address will CGW report" is answerable
   * from a single place.
   */
  public getDeployment(chainId: string): PolicyDeployment {
    return this.deployments[chainId] ?? DEFAULT_POLICY_DEPLOYMENT;
  }

  public getSafePolicyGuard(chainId: string): Address {
    return this.getDeployment(chainId).safePolicyGuard;
  }

  /**
   * Address of the policy contract implementing {@link type} on {@link chainId},
   * `null` for a module-enforced type and for a guard-enforced one the chain's
   * deployment does not name.
   */
  public getPolicyContract(chainId: string, type: PolicyType): Address | null {
    if (!isGuardPolicyType(type)) {
      return null;
    }
    return this.getDeployment(chainId).policyContracts[type] ?? null;
  }

  /**
   * Address of the module enforcing {@link type} on {@link chainId}, or `null`
   * when unknown - which leaves the entry's `enforcement` empty.
   */
  public getModuleAddress(chainId: string, type: PolicyType): Address | null {
    if (type === PolicyType.SpendingLimit) {
      // Authoritative source; never duplicated in POLICY_DEPLOYMENTS.
      const [allowanceModule] = getAllowanceModuleDeployments({ chainId });
      return allowanceModule ?? null;
    }

    if (type === PolicyType.Recovery) {
      return (
        this.getDeployment(chainId).moduleAddresses[PolicyType.Recovery] ?? null
      );
    }

    return null;
  }

  private buildDeployments(): PolicyDeployments {
    const configured = this.configurationService.get<string>(
      'policies.deployments',
    );

    if (!configured) {
      return {};
    }

    const parsed = PolicyDeploymentsSchema.safeParse(
      this.parseJson(configured),
    );

    if (!parsed.success) {
      // A malformed value must not take the service down. There is nothing to
      // fall back to, so every chain reports its guard-enforced policies as
      // unavailable - which is why the misconfiguration is logged as an error.
      this.loggingService.error({
        message: 'Invalid POLICY_ENGINE_DEPLOYMENTS, ignoring the override',
        error: parsed.error.message,
      });
      return {};
    }

    return parsed.data;
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
