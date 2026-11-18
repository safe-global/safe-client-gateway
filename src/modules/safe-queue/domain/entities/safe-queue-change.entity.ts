// SPDX-License-Identifier: FSL-1.1-MIT

/** What of a Safe can change in the Queue Service. */
export const SafeQueueChanges = ['transaction_queue', 'messages'] as const;

export type SafeQueueChange = (typeof SafeQueueChanges)[number];
