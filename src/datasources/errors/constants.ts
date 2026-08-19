// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * HTTP 451 Unavailable For Legal Reasons.
 *
 * Declared here because Nest's `HttpStatus` enum does not include it.
 * The Transaction Service returns it on every Safe-scoped endpoint when the
 * Safe is banned from the indexer for legal reasons.
 *
 * @see https://github.com/safe-global/safe-transaction-service/pull/2966
 */
export const UNAVAILABLE_FOR_LEGAL_REASONS_STATUS = 451;

/**
 * Client-facing message paired with {@link UNAVAILABLE_FOR_LEGAL_REASONS_STATUS}.
 *
 * The upstream payload is deliberately not forwarded: it is not client-facing
 * copy and its shape is not part of any contract this gateway relies on.
 */
export const UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE =
  'Unavailable for legal reasons';
