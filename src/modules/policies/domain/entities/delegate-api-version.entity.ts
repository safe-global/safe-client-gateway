// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Which Transaction Service delegates API a proposer grant was read from.
 *
 * A grant is revoked through the API that holds it, so the client has to be
 * told which one that is. `v2` is always the Transaction Service; `v3` is the
 * Queue Service, or the Transaction Service again while the Queue Service is
 * switched off.
 */
export const DelegateApiVersion = { V2: 'v2', V3: 'v3' } as const;

export type DelegateApiVersion =
  (typeof DelegateApiVersion)[keyof typeof DelegateApiVersion];
