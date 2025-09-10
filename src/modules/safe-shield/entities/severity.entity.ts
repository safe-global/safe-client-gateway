import { z } from 'zod';

/**
 * Analysis result severity levels for Safe Shield security analysis.
 *
 * Used to classify the importance and risk level of security findings.
 * Numeric ordering for severity levels to enable proper sorting.
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
 * Zod schema for validating Severity enum values.
 *
 * @example
 * ```typescript
 * const severity = SeveritySchema.parse('CRITICAL'); // Severity.CRITICAL
 * const severity2 = SeveritySchema.parse(Severity.WARN); // Severity.WARN
 * ```
 */
export const SeveritySchema = z.preprocess(
  (val) =>
    typeof val === 'string' && val in Severity
      ? (Severity as unknown as Record<string, Severity>)[val]
      : val,
  z.nativeEnum(Severity),
);
