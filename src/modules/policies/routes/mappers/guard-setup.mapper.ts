// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { PendingGuardSetup } from '@/modules/policies/domain/entities/pending-policy.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';

/**
 * Finds the queued transactions that set up the `SafePolicyGuard` of a Safe.
 */
@Injectable()
export class GuardSetupMapper {
  /**
   * @param args.guard The Safe's current transaction guard.
   * @param args.moduleGuard The Safe's current module guard.
   */
  public map(_args: {
    safe: SafeRef;
    guard: Address | null;
    moduleGuard: Address | null;
    transactions: ReadonlyArray<MultisigTransaction>;
  }): Array<PendingGuardSetup> {
    // Placeholder: replaced in step 3. Setup transactions are not detected yet.
    return [];
  }
}
