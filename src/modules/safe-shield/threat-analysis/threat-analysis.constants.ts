import type { CommonStatus } from '@/modules/safe-shield/entities/analysis-result.entity';
import { COMMON_SEVERITY_MAPPING } from '@/modules/safe-shield/entities/common-status.constants';
import type { Severity } from '@/modules/safe-shield/entities/severity.entity';
import type { ThreatStatus } from '@/modules/safe-shield/entities/threat-status.entity';

/**
 * Severity mapping for threat analysis results.
 * Maps each contract status to its corresponding severity level.
 */
export const SEVERITY_MAPPING: Record<
  ThreatStatus | CommonStatus,
  keyof typeof Severity
> = {
  ...COMMON_SEVERITY_MAPPING,
  MALICIOUS: 'CRITICAL',
  MODERATE: 'WARN',
  NO_THREAT: 'OK',
  MASTERCOPY_CHANGE: 'WARN',
  OWNERSHIP_CHANGE: 'WARN',
  MODULE_CHANGE: 'WARN',
};

/**
 * Title mapping for threat analysis results.
 * Maps each threat status to its user-facing title.
 */
export const TITLE_MAPPING: Record<ThreatStatus | CommonStatus, string> = {
  MALICIOUS: 'Malicious threat detected',
  MODERATE: 'Moderate threat detected',
  NO_THREAT: 'No threat detected',
  MASTERCOPY_CHANGE: 'Mastercopy change',
  OWNERSHIP_CHANGE: 'Ownership change',
  MODULE_CHANGE: 'Modules change',
  FAILED: 'Threat analysis failed',
};

type DescriptionArgs = {
  description?: string;
  error?: string;
};

/**
 * Description mapping for threat analysis results.
 * Maps each threat status to a function that generates the description.
 */
export const DESCRIPTION_MAPPING: Record<
  ThreatStatus | CommonStatus,
  (args?: DescriptionArgs) => string
> = {
  MALICIOUS: ({ description } = {}) => `${description || ''}`,
  MODERATE: ({ description } = {}) =>
    `${description ? `${description} ` : ''}Review before processing.`,
  NO_THREAT: () => 'Threat analysis found no issues.',
  MASTERCOPY_CHANGE: () =>
    'Verify this change as it may overwrite account ownership.',
  OWNERSHIP_CHANGE: () =>
    "Verify this change before proceeding as it will change the Safe's ownership",
  MODULE_CHANGE: () =>
    'Verify this change before proceeding as it will change Safe modules.',
  FAILED: ({ error } = {}) =>
    `Threat analysis failed. Review before processing.${error ? ` (${error})` : ''}`,
};
