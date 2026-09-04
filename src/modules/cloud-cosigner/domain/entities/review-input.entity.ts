// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { CloudCosignerPolicy } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';
import type { PolicyEvaluation } from '@/modules/cloud-cosigner/domain/policy-evaluator';
import type { TransactionValuation } from '@/modules/cloud-cosigner/domain/transaction-analysis';
import type { DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';

// One executed transaction of the Safe, as behavioural context for a review.
export type HistoryEntry = {
  to: Address;
  value: string;
  selector: Hex | null;
  operation: Operation;
  executionDate: Date | null;
};

export type ReviewInput = {
  chainId: string;
  chainName: string | null;
  fiatCode: string;
  safe: Safe;
  cosignerAddress: Address;
  policy: CloudCosignerPolicy;
  transaction: MultisigTransaction;
  dataDecoded: DataDecoded | null;
  valuation: TransactionValuation;
  evaluation: PolicyEvaluation;
  knownContracts: Array<Address>;
  history: Array<HistoryEntry>;
};
