// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type {
  CloudCosignerPolicy,
  SafeCloudCosignerPolicy,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';
import type { CloudCosignerReview } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';

export const ICloudCosignerRepository = Symbol('ICloudCosignerRepository');

export type ReviewClaim =
  | { claimed: true; review: CloudCosignerReview }
  | { claimed: false; review: CloudCosignerReview };

export type ReviewResult = Pick<
  CloudCosignerReview,
  'status' | 'mode' | 'triggeredRules' | 'summary' | 'riskFlags' | 'model'
> & { signature: Hex | null };

export interface ICloudCosignerRepository {
  getPolicy(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<SafeCloudCosignerPolicy | null>;

  upsertPolicy(args: {
    chainId: string;
    safeAddress: Address;
    policy: CloudCosignerPolicy;
  }): Promise<SafeCloudCosignerPolicy>;

  getReview(args: {
    chainId: string;
    safeTxHash: Hex;
  }): Promise<CloudCosignerReview | null>;

  /**
   * Claims the review of `safeTxHash` for the calling worker. A terminal row
   * (approved, rejected, skipped) or a fresh pending one belonging to another
   * worker is returned with `claimed: false`; a failed or stale pending row
   * is reset to pending and returned with `claimed: true`.
   */
  claimReview(args: {
    chainId: string;
    safeAddress: Address;
    safeTxHash: Hex;
    stalePendingAfterMs: number;
  }): Promise<ReviewClaim>;

  completeReview(args: {
    id: CloudCosignerReview['id'];
    result: ReviewResult;
  }): Promise<CloudCosignerReview>;

  failReview(args: {
    id: CloudCosignerReview['id'];
    summary: string;
  }): Promise<void>;
}
