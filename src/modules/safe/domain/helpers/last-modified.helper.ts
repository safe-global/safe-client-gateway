// SPDX-License-Identifier: FSL-1.1-MIT
import max from 'lodash/max';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';

/**
 * The most recent point in time a queued multisig transaction changed: the
 * transaction's own `modified` date or, if later, the submission date of its
 * newest confirmation.
 *
 * `txQueuedTag` is derived from this value. Taking the confirmations into
 * account means the tag moves on a new signature even when the upstream
 * service does not bump the transaction's `modified` date for it.
 */
export function getLastModified(transaction: MultisigTransaction): Date | null {
  const dates = [
    transaction.modified,
    ...(transaction.confirmations ?? []).map(
      (confirmation) => confirmation.submissionDate,
    ),
  ].filter((date): date is Date => date instanceof Date);

  return max(dates) ?? null;
}
