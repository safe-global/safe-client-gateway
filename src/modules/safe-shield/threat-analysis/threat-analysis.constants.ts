import type { Severity } from '@/modules/safe-shield/entities/severity.entity';
import type { ThreatStatus } from '@/modules/safe-shield/entities/threat-status.entity';

export const SAFE_VERSION = '1.3.0';
/**
 * Severity mapping for threat analysis results.
 * Maps each contract status to its corresponding severity level.
 */
export const SEVERITY_MAPPING: Record<ThreatStatus, keyof typeof Severity> = {
  MALICIOUS: 'CRITICAL',
  MODERATE: 'WARN',
  NO_THREAT: 'OK',
  FAILED: 'WARN',
  MASTER_COPY_CHANGE: 'WARN',
  OWNERSHIP_CHANGE: 'WARN',
  MODULE_CHANGE: 'WARN',
};

/**
 * Title mapping for threat analysis results.
 * Maps each threat status to its user-facing title.
 */
export const TITLE_MAPPING: Record<ThreatStatus, string> = {
  MALICIOUS: 'Malicious threat detected',
  MODERATE: 'Moderate threat detected',
  NO_THREAT: 'No threat detected',
  FAILED: 'Threat analysis failed',
  MASTER_COPY_CHANGE: 'Mastercopy change',
  OWNERSHIP_CHANGE: 'Ownership change',
  MODULE_CHANGE: 'Modules change',
};

type DescriptionArgs = {
  reason?: string;
  classification?: string;
};

/**
 * Description mapping for threat analysis results.
 * Maps each threat status to a function that generates the description.
 */
export const DESCRIPTION_MAPPING: Record<
  ThreatStatus,
  (args?: DescriptionArgs) => string
> = {
  MALICIOUS: ({ reason, classification } = {}) =>
    `The transaction ${reason} ${classification}.`,
  MODERATE: ({ reason, classification } = {}) =>
    `The transaction${reason ? ` ${reason}` : ''}${classification ? ` ${classification}` : ''}. Cancel this transaction.`,
  NO_THREAT: () => 'Threat analysis found no issues.',
  FAILED: ({ reason } = {}) =>
    `Threat analysis failed. Review before processing.${reason ? ` (${reason}).` : ''}`,
  MASTER_COPY_CHANGE: () =>
    'Verify this change as it may overwrite account ownership.',
  OWNERSHIP_CHANGE: () =>
    "Verify this change before proceeding as it will change the Safe's ownership",
  MODULE_CHANGE: () =>
    'Verify this change before proceeding as it will change Safe modules.',
};
