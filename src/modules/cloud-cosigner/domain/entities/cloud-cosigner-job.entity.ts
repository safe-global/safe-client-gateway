// SPDX-License-Identifier: FSL-1.1-MIT
import type { Job } from 'bullmq';
import type { Address, Hex } from 'viem';

export type CloudCosignerReviewJobData = {
  chainId: string;
  safeAddress: Address;
  safeTxHash: Hex;
};

export type CloudCosignerJob = Job<CloudCosignerReviewJobData>;
