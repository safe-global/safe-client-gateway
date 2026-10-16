// SPDX-License-Identifier: FSL-1.1-MIT
import { encodeAbiParameters, getAbiItem, type Hex, keccak256 } from 'viem';
import { SafePolicyGuardAbi } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';

/** `Configuration[]`, as `applyConfiguration` takes it. */
const CONFIGURATION_ABI_PARAMETERS = getAbiItem({
  abi: SafePolicyGuardAbi,
  name: 'applyConfiguration',
}).inputs;

/**
 * The configuration root of a delayed configuration request:
 * `keccak256(abi.encode(Configuration[]))`, as the guard computes it in
 * `applyConfiguration`. Order-sensitive, as `abi.encode` of an array is.
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
