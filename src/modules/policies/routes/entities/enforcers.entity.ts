// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

/**
 * What a Safe enforces policies with: its enabled modules and the guards in its
 * two slots. `null` stands for an empty slot.
 */
export type Enforcers = {
  enabledModules: ReadonlyArray<Address>;
  transactionGuard: Address | null;
  moduleGuard: Address | null;
};
