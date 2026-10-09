// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerSafePolicy,
} from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PendingGuardConfiguration } from '@/modules/policies/domain/entities/pending-policy.entity';
import type { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import type { StoredPolicyConfiguration } from '@/modules/policies/domain/entities/stored-policy-configuration.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';

/**
 * Works out where each delayed `SafePolicyGuard` configuration of a Safe
 * stands, one item per root.
 */
@Injectable()
export class GuardConfigurationMapper {
  /**
   * @param args.roots The Safe's configuration roots, from the indexer.
   * @param args.stored The configurations CGW stored for the Safe.
   * @param args.bindings The Safe's current guard policy bindings.
   * @param args.expiries `EXPIRY` in seconds, per guard address.
   * @param args.types The requested policy types.
   * @param args.now Unix seconds.
   */
  public map(_args: {
    safe: SafeRef;
    transactions: ReadonlyArray<MultisigTransaction>;
    roots: ReadonlyArray<PolicyIndexerConfigurationRoot>;
    stored: ReadonlyArray<StoredPolicyConfiguration>;
    bindings: ReadonlyArray<PolicyIndexerSafePolicy>;
    expiries: ReadonlyMap<Address, number>;
    types: ReadonlyArray<PolicyType>;
    now: number;
  }): Array<PendingGuardConfiguration> {
    // Placeholder: replaced in step 5. Configuration statuses are not derived yet.
    return [];
  }
}
