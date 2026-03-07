// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const DeadlockStatus = {
  /** Direct/mutual deadlock found between two Safes at depth 1 */
  DEADLOCK_DETECTED: 'DEADLOCK_DETECTED',

  /** Nested Safe owners exist at depth > 1; cannot fully verify deadlock-freedom */
  NESTED_SAFE_WARNING: 'NESTED_SAFE_WARNING',
} as const;

export const DeadlockStatusSchema = z.enum(DeadlockStatus);

export type DeadlockStatus = z.infer<typeof DeadlockStatusSchema>;
