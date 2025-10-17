import type { CommonStatus } from './analysis-result.entity';
import type { Severity } from './severity.entity';

/**
 * Severity mapping for common status values.
 * This can be spread into specific analysis type severity mappings.
 */
export const COMMON_SEVERITY_MAPPING: Record<
  CommonStatus,
  keyof typeof Severity
> = {
  FAILED: 'CRITICAL',
};

/**
 * Title mapping for common status values.
 * This can be spread into specific analysis type title mappings.
 */
export const COMMON_TITLE_MAPPING: Record<CommonStatus, string> = {
  FAILED: 'Analysis failed',
};

/**
 * Description mapping for common status values.
 * This can be spread into specific analysis type description mappings.
 */
export const COMMON_DESCRIPTION_MAPPING: Record<
  CommonStatus,
  (args?: { reason?: string }) => string
> = {
  FAILED: ({ reason } = {}) =>
    `The analysis failed${reason ? `: ${reason}` : ''}. Please try again later.`,
};
