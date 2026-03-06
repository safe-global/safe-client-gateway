import { z } from 'zod';

export const DeadlockStatus = {
  /** Direct/mutual deadlock found between two Safes at depth 1 */
  DEADLOCK_DETECTED: 'DEADLOCK_DETECTED',

  /** Nested Safe owners exist at depth > 1; cannot fully verify deadlock-freedom */
  NESTED_SAFE_WARNING: 'NESTED_SAFE_WARNING',

  /** Failed to fetch owner/threshold data for one or more nested Safes */
  DEADLOCK_UNKNOWN: 'DEADLOCK_UNKNOWN',

  /** No deadlock detected; all owners are EOAs or no circular dependency exists */
  NO_DEADLOCK: 'NO_DEADLOCK',
} as const;

export const DeadlockStatusSchema = z.enum(DeadlockStatus);

export type DeadlockStatus = z.infer<typeof DeadlockStatusSchema>;
