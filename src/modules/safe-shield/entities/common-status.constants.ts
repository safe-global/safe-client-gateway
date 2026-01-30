import { CommonStatus } from './analysis-result.entity';
import type { Severity } from './severity.entity';

/**
 * Severity mapping for common status values.
 * This can be spread into specific analysis type severity mappings.
 */
export const COMMON_SEVERITY_MAPPING: Record<
  CommonStatus,
  keyof typeof Severity
> = {
  [CommonStatus.FAILED]: 'WARN',
};

/**
 * Description mapping for common status values.
 * This can be spread into specific analysis type description mappings.
 */
export const COMMON_DESCRIPTION_MAPPING: Record<
  CommonStatus,
  (args?: { error?: string }) => string
> = {
  [CommonStatus.FAILED]: ({ error } = {}) =>
    `The analysis failed${error ? `: ${error}` : ''}. Please try again later.`,
};
