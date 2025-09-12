import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { z } from 'zod';

/**
 * Analysis result severity levels for Safe Shield security analysis.
 * Lower numeric values indicate lower severity levels.
 */
export enum Severity {
  /** No security issues detected - transaction appears safe */
  OK = 0,

  /** Informational notice - no immediate risk but worth noting */
  INFO = 1,

  /** Potential risk requiring user attention before proceeding */
  WARN = 2,

  /** High-risk situation requiring immediate review and caution */
  CRITICAL = 3,
}

/**
 * Compare two severity levels for sorting.
 *
 * @param a - First severity level
 * @param b - Second severity level
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return a - b;
}

/**
 * Compare two severity levels for sorting.
 *
 * @param a - First severity level as string key
 * @param b - Second severity level as string key
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function compareSeverityString(
  a: keyof typeof Severity,
  b: keyof typeof Severity,
): number {
  return compareSeverity(Severity[a], Severity[b]);
}

/**
 * Zod schema for validating Severity enum values.
 */
export const SeveritySchema = z.enum(getStringEnumKeys(Severity));
