// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { CloudCosignerPolicy } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';

/**
 * The EIP-191 message an owner signs to update a Safe's cosigner policy.
 * The web client builds the identical string, so any change here is a
 * protocol change for both sides.
 */
export function buildPolicyMessage(args: {
  chainId: string;
  safeAddress: Address;
  issuedAt: string;
  policy: CloudCosignerPolicy;
}): string {
  return [
    'Safe cloud cosigner policy update',
    `Chain ID: ${args.chainId}`,
    `Safe: ${args.safeAddress}`,
    `Issued at: ${args.issuedAt}`,
    `Value threshold (USD): ${args.policy.valueThresholdUsd}`,
    `Review unknown contracts: ${args.policy.reviewUnknownContracts}`,
    'Instructions:',
    args.policy.instructions ?? '',
  ].join('\n');
}
