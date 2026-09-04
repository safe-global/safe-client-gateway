// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  CloudCosignerReview,
  ReviewStatus,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';

export type ProcessOutcome =
  | { kind: 'not_enrolled' }
  | { kind: 'already_handled'; status: ReviewStatus }
  | { kind: 'reviewed'; review: CloudCosignerReview };
