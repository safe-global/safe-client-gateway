// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

/** What of a Safe can change in the Queue Service. */
export const SafeQueueChanges = ['transaction_queue', 'messages'] as const;

export type SafeQueueChange = (typeof SafeQueueChanges)[number];

/** One kind of change of one Safe. */
export type SafeQueueChangeKey = {
  change: SafeQueueChange;
  chainId: string;
  safeAddress: Address;
};
