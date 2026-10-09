// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import { AbiDecoder } from '@/modules/contracts/domain/decoders/abi-decoder.helper';

/**
 * The parts of `SafePolicyGuard` CGW reads, from
 * `safe-research/policy-engine` `contracts/SafePolicyGuard.sol`.
 */
export const SafePolicyGuardAbi = parseAbi([
  'struct Configuration { address target; bytes4 selector; uint8 operation; address policy; bytes data; }',
  'function configureImmediately(Configuration[] configurations)',
  'function requestConfiguration(bytes32 configureRoot)',
  'function applyConfiguration(Configuration[] configurations)',
  'function invalidateRoot(bytes32 configureRoot)',
  'function DELAY() view returns (uint256)',
  'function EXPIRY() view returns (uint256)',
]);

@Injectable()
export class SafePolicyGuardDecoder extends AbiDecoder<
  typeof SafePolicyGuardAbi
> {
  constructor() {
    super(SafePolicyGuardAbi);
  }
}
