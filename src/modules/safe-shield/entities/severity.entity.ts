import { z } from 'zod';

/**
 * Analysis result severity levels for Safe Shield security analysis.
 *
 * Used to classify the importance and risk level of security findings.
 * These string values provide clear, human-readable severity levels while
 * maintaining sorting capability through the SeverityOrder mapping.
 */
export enum Severity {
  /** No security issues detected - transaction appears safe */
  OK = 'OK',

  /** Informational notice - no immediate risk but worth noting */
  INFO = 'INFO',

  /** Potential risk requiring user attention before proceeding */
  WARN = 'WARN',

  /** High-risk situation requiring immediate review and caution */
  CRITICAL = 'CRITICAL',
}

/**
 * Numeric ordering for severity levels to enable proper sorting.
 * Higher numbers indicate more critical security concerns.
 * CRITICAL (3) > WARN (2) > INFO (1) > OK (0).
 */
export const SeverityOrder: Record<Severity, number> = {
  [Severity.OK]: 0,
  [Severity.INFO]: 1,
  [Severity.WARN]: 2,
  [Severity.CRITICAL]: 3,
} as const;

/**
 * Zod schema for validating Severity enum values.
 *
 * @example
 * ```typescript
 * const severity = SeveritySchema.parse('CRITICAL'); // Severity.CRITICAL
 * const severity2 = SeveritySchema.parse(Severity.WARN); // Severity.WARN
 * ```
 */
export const SeveritySchema = z.nativeEnum(Severity);

/**
 * Helper function to get the numeric order value for a severity level.
 *
 * @param severity - Severity level
 * @returns Numeric order value for sorting
 *
 * @example
 * ```typescript
 * getSeverityOrder(Severity.CRITICAL); // 3
 * getSeverityOrder(Severity.OK); // 0
 * ```
 */
export function getSeverityOrder(severity: Severity): number {
  return SeverityOrder[severity];
}

/**
 * Helper function to compare two severity levels for sorting.
 *
 * @param a - First severity level
 * @param b - Second severity level
 * @returns Positive number if a > b, negative if a < b, zero if equal
 *
 * @example
 * ```typescript
 * compareSeverity(Severity.CRITICAL, Severity.WARN); // 1 (CRITICAL > WARN)
 * compareSeverity(Severity.INFO, Severity.CRITICAL); // -2 (INFO < CRITICAL)
 *
 * // Usage in array sorting (highest severity first)
 * const results = [...analysisResults].sort((a, b) =>
 *   compareSeverity(b.severity, a.severity)
 * );
 * ```
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return getSeverityOrder(a) - getSeverityOrder(b);
}
