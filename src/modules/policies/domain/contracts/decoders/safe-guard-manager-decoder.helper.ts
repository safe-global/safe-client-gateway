// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import { AbiDecoder } from '@/modules/contracts/domain/decoders/abi-decoder.helper';

/**
 * The Safe's guard setters. `setModuleGuard` exists from Safe 1.5.0 on, so it is
 * not in the 1.3.0 ABI that `SafeDecoder` uses.
 */
export const SafeGuardManagerAbi = parseAbi([
  'function setGuard(address guard)',
  'function setModuleGuard(address moduleGuard)',
]);

@Injectable()
export class SafeGuardManagerDecoder extends AbiDecoder<
  typeof SafeGuardManagerAbi
> {
  constructor() {
    super(SafeGuardManagerAbi);
  }
}
