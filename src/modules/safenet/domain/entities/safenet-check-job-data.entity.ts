// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { JobData } from '#/datasources/job-queue/types/job-types';
import type { BaseMultisigTransaction } from '#/domain/common/utils/safe';

/** What the queue stores of a check: JSON has no bigint, so it keeps the tx-service fields. */
export interface SafenetCheckJobData extends JobData {
  chainId: string;
  safe: Address;
  safeTxHash: Hex;
  transaction: BaseMultisigTransaction;
}
