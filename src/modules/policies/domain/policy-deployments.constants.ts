// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyDeployments } from '@/modules/policies/domain/entities/policy-deployment.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * Policy-engine deployments per chain, transcribed from the policy-engine
 * repository.
 *
 * Kept in code rather than in the database on purpose: a deployment is added by
 * a release, and the same values must stay in sync with the Transaction
 * Service's `policies/constants.py`. `POLICY_ENGINE_DEPLOYMENTS` overrides an
 * entry at runtime so a new chain does not need a code change.
 *
 * TODO(WA-2914): replace with `@safe-global/safe-modules-deployments` once
 * safe-research/policy-engine publishes its deployments there, and generate
 * both this map and the Transaction Service's from the same source.
 *
 * @see https://github.com/safe-research/policy-engine
 */
export const POLICY_DEPLOYMENTS: PolicyDeployments = {
  // Sepolia
  '11155111': {
    safePolicyGuard: '0xde4c448904537EBBA654Ac3803E7D74A77C7a1a8',
    policyContracts: {
      [PolicyType.Erc20Transfer]: '0xec399EE72199DBc1f7DCf8b69cFa0290d1e06Fb7',
      // TODO(WA-2914): CoSignerPolicy deployment address is not published yet.
      // Until it is set, cosigner is reported as unavailable and cosigner
      // confirmations cannot be typed by address.
    },
    moduleAddresses: {
      // TODO(WA-2914): the Zodiac Delay Modifier used by the recovery feature
      // is deployed per Safe through the Zodiac module factory and is not part
      // of any Safe deployments package, so there is no authoritative
      // chain-level address to publish here. Recovery is reported as
      // unavailable until this is resolved (Phase 2).
      //
      // `spending-limit` is intentionally absent: the AllowanceModule address
      // is resolved from `@safe-global/safe-modules-deployments` instead of
      // being duplicated here.
    },
  },
};
