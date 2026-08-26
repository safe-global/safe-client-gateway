// SPDX-License-Identifier: FSL-1.1-MIT
import { encodeAbiParameters, type Hex, keccak256 } from 'viem';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';

/**
 * ABI layout of `SafePolicyGuard.Configuration`, in declaration order - the
 * order `abi.encode` follows.
 */
const CONFIGURATION_ABI_PARAMETERS = [
  {
    type: 'tuple[]',
    components: [
      { name: 'target', type: 'address' },
      { name: 'selector', type: 'bytes4' },
      { name: 'operation', type: 'uint8' },
      { name: 'policy', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
  },
] as const;

/**
 * The configuration root of a delayed configuration request:
 * `keccak256(abi.encode(Configuration[]))`, as the guard computes it in
 * `applyConfiguration` and as the requester passes it to
 * `requestConfiguration`.
 *
 * Recomputing it is what lets CGW store a submitted `Configuration[]` without
 * trusting the submitter: a payload that does not hash to a root the Safe
 * requested on-chain is rejected.
 *
 * Note: the root is order-sensitive, as `abi.encode` of an array is - two
 * requests with the same configurations in a different order are different
 * requests.
 *
 * @see https://github.com/safe-research/policy-engine
 */
export function configurationRoot(
  configurations: ReadonlyArray<PolicyConfiguration>,
): Hex {
  return keccak256(
    encodeAbiParameters(CONFIGURATION_ABI_PARAMETERS, [configurations]),
  );
}
