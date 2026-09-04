// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { CloudCosignerPolicy } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';

export type SafeCosignerStatus = {
  cosignerAddress: Address;
  // Whether the cosigner is currently an owner of the Safe.
  isEnabled: boolean;
  policy: CloudCosignerPolicy;
  // True when no policy is stored and the configured defaults apply.
  isDefaultPolicy: boolean;
};
