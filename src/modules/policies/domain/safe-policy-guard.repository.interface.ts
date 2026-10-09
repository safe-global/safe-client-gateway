// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

export const ISafePolicyGuardRepository = Symbol('ISafePolicyGuardRepository');

export interface ISafePolicyGuardRepository {
  /**
   * The guard's `EXPIRY`: how many seconds a root stays applicable after its
   * `readyAt`. Fixed when the guard is deployed.
   */
  getExpiry(args: { chainId: string; guard: Address }): Promise<number>;
}
