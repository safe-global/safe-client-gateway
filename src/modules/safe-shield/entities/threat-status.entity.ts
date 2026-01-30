import { z } from 'zod';

/**
 * Status codes for threat analysis in Safe Shield security checks.
 *
 * These statuses are returned by transaction-level threat analysis (typically
 * via Blockaid integration) to identify malicious patterns, ownership changes,
 * and other critical security risks at the transaction level.
 */
export const ThreatStatus = {
  /** Transaction contains malicious patterns or known threats */
  MALICIOUS: 'MALICIOUS',

  /** Transaction has moderate risk indicators */
  MODERATE: 'MODERATE',

  /** No threats detected in the transaction */
  NO_THREAT: 'NO_THREAT',

  /** Transaction attempts to change Safe master copy/implementation */
  MASTERCOPY_CHANGE: 'MASTERCOPY_CHANGE',

  /** Transaction attempts to modify Safe ownership */
  OWNERSHIP_CHANGE: 'OWNERSHIP_CHANGE',
  /** Transaction attempts to modify Safe modules */
  MODULE_CHANGE: 'MODULE_CHANGE',
} as const;

/**
 * Zod schema for validating ThreatStatus enum values.
 *
 * @example
 * ```typescript
 * const status = ThreatStatusSchema.parse('MALICIOUS');
 * ```
 */
export const ThreatStatusSchema = z.enum(ThreatStatus);

export type ThreatStatus = z.infer<typeof ThreatStatusSchema>;
