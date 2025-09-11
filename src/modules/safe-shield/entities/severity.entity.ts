import { z } from 'zod';

/**
 * Analysis result severity levels for Safe Shield security analysis.
 */
export const Severity = [
  /** No security issues detected - transaction appears safe */
  'OK',

  /** Informational notice - no immediate risk but worth noting */
  'INFO',

  /** Potential risk requiring user attention before proceeding */
  'WARN',

  /** High-risk situation requiring immediate review and caution */
  'CRITICAL',
] as const;

/**
 * Mapping of severity levels to their numeric order for sorting.
 * Lower numbers indicate lower severity.
 */
export const SeverityOrder: Record<Severity, number> = {
  OK: 0,
  INFO: 1,
  WARN: 2,
  CRITICAL: 3,
} as const;

/**
 * Get the numeric order value for a severity level.
 *
 * @param severity - The severity level
 * @returns The numeric order (0-3)
 */
export function getSeverityOrder(severity: Severity): number {
  return SeverityOrder[severity];
}

/**
 * Compare two severity levels for sorting.
 *
 * @param a - First severity level
 * @param b - Second severity level
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return getSeverityOrder(a) - getSeverityOrder(b);
}

/**
 * Zod schema for validating Severity enum values.
 *
 * @example
 * ```typescript
 * const severity = SeveritySchema.parse('CRITICAL'); // 'CRITICAL'
 * const severity2 = SeveritySchema.parse('WARN'); // 'WARN'
 * ```
 */
export const SeveritySchema = z.enum(Severity);

export type Severity = z.infer<typeof SeveritySchema>;
