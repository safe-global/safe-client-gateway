import { CommonStatus } from '@/modules/safe-shield/entities/analysis-result.entity';
import { COMMON_SEVERITY_MAPPING } from '@/modules/safe-shield/entities/common-status.constants';
import type { Severity } from '@/modules/safe-shield/entities/severity.entity';
import { ThreatStatus } from '@/modules/safe-shield/entities/threat-status.entity';

/**
 * Severity mapping for threat analysis results.
 * Maps each contract status to its corresponding severity level.
 */
export const SEVERITY_MAPPING: Record<
  ThreatStatus | CommonStatus,
  keyof typeof Severity
> = {
  ...COMMON_SEVERITY_MAPPING,
  [ThreatStatus.MALICIOUS]: 'CRITICAL',
  [ThreatStatus.MODERATE]: 'WARN',
  [ThreatStatus.NO_THREAT]: 'OK',
  [ThreatStatus.MASTERCOPY_CHANGE]: 'WARN',
  [ThreatStatus.OWNERSHIP_CHANGE]: 'WARN',
  [ThreatStatus.MODULE_CHANGE]: 'WARN',
};

/**
 * Title mapping for threat analysis results.
 * Maps each threat status to its user-facing title.
 */
export const TITLE_MAPPING: Record<ThreatStatus | CommonStatus, string> = {
  [ThreatStatus.MALICIOUS]: 'Malicious threat detected',
  [ThreatStatus.MODERATE]: 'Moderate threat detected',
  [ThreatStatus.NO_THREAT]: 'No threat detected',
  [ThreatStatus.MASTERCOPY_CHANGE]: 'Mastercopy change',
  [ThreatStatus.OWNERSHIP_CHANGE]: 'Ownership change',
  [ThreatStatus.MODULE_CHANGE]: 'Modules change',
  [CommonStatus.FAILED]: 'Threat analysis failed',
};

type DescriptionArgs = {
  description?: string;
};

/**
 * Description mapping for threat analysis results.
 * Maps each threat status to a function that generates the description.
 */
export const DESCRIPTION_MAPPING: Record<
  ThreatStatus | CommonStatus,
  (args?: DescriptionArgs) => string
> = {
  [ThreatStatus.MALICIOUS]: ({ description } = {}) => `${description || ''}`,
  [ThreatStatus.MODERATE]: ({ description } = {}) =>
    `${description ? `${description} ` : ''}Review before processing.`,
  [ThreatStatus.NO_THREAT]: () => 'Threat analysis found no issues.',
  [ThreatStatus.MASTERCOPY_CHANGE]: () =>
    'Verify this change as it may overwrite account ownership.',
  [ThreatStatus.OWNERSHIP_CHANGE]: () =>
    "Verify this change before proceeding as it will change the Safe's ownership",
  [ThreatStatus.MODULE_CHANGE]: () =>
    'Verify this change before proceeding as it will change Safe modules.',
  [CommonStatus.FAILED]: () =>
    `Threat analysis failed. Review before processing.`,
};
