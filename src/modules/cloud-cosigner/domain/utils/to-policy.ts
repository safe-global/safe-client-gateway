// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  CloudCosignerPolicy,
  SafeCloudCosignerPolicy,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';

export function toPolicy(stored: SafeCloudCosignerPolicy): CloudCosignerPolicy {
  return {
    valueThresholdUsd: stored.valueThresholdUsd,
    reviewUnknownContracts: stored.reviewUnknownContracts,
    instructions: stored.instructions,
  };
}
