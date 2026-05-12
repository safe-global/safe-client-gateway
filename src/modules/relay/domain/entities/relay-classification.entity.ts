// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { SafeTransaction } from '@/modules/transactions/domain/entities/safe-transaction.entity';

/**
 * Result of validating relay calldata. Each variant corresponds to one branch
 * of the legacy `LimitAddressesMapper` ladder. Producing a classification
 * means the calldata is structurally valid for that branch (e.g. `multiSend`
 * was on an official deployment with consistent recipients); validation
 * failures are signalled by the rule throwing a domain error instead.
 */
export type RelayClassification =
  | { kind: 'recovery'; safeAddress: Address }
  | {
      kind: 'execTransaction';
      safeAddress: Address;
      // Carried forward so RelayFeeRelayer doesn't need to re-decode the
      // calldata to verify the on-chain safeTxHash.
      decoded: SafeTransaction;
    }
  | { kind: 'multiSend'; safeAddress: Address }
  | { kind: 'createProxy'; owners: ReadonlyArray<Address> }
  | { kind: 'createSigner'; limitAddress: Address };
