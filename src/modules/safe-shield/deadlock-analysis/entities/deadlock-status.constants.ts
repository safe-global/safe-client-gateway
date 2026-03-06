// SPDX-License-Identifier: FSL-1.1-MIT
import { DeadlockStatus } from './deadlock-status.entity';
import type { Severity } from '../../entities/severity.entity';

export const DEADLOCK_SEVERITY_MAPPING: Record<
  DeadlockStatus,
  keyof typeof Severity
> = {
  [DeadlockStatus.DEADLOCK_DETECTED]: 'CRITICAL',
  [DeadlockStatus.NESTED_SAFE_WARNING]: 'WARN',
  [DeadlockStatus.DEADLOCK_UNKNOWN]: 'WARN',
  [DeadlockStatus.NO_DEADLOCK]: 'OK',
};

export const DEADLOCK_TITLE_MAPPING: Record<DeadlockStatus, string> = {
  [DeadlockStatus.DEADLOCK_DETECTED]: 'Signing deadlock risk detected',
  [DeadlockStatus.NESTED_SAFE_WARNING]: 'Full signer verification unavailable',
  [DeadlockStatus.DEADLOCK_UNKNOWN]: 'Full signer verification unavailable',
  [DeadlockStatus.NO_DEADLOCK]: 'No signing deadlock detected',
};

export const DEADLOCK_DESCRIPTION_MAPPING: Record<DeadlockStatus, string> = {
  [DeadlockStatus.DEADLOCK_DETECTED]:
    'This change may create a signing cycle between Safes and can permanently lock funds. You will not be allowed to proceed forward.',
  [DeadlockStatus.NESTED_SAFE_WARNING]:
    "We couldn't verify the complete signer configuration for one or more owners. A signing deadlock may exist that could permanently lock funds. Proceed only if you're confident in your setup.",
  [DeadlockStatus.DEADLOCK_UNKNOWN]:
    "We couldn't verify the complete signer configuration for one or more owners. A signing deadlock may exist that could permanently lock funds. Proceed only if you're confident in your setup.",
  [DeadlockStatus.NO_DEADLOCK]:
    'The proposed owner and threshold configuration does not create any signing deadlocks.',
};
