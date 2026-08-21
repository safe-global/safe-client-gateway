// SPDX-License-Identifier: FSL-1.1-MIT
import {
  UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
  UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
} from '@/datasources/errors/constants';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';

/**
 * Whether a response reports a Safe banned from the indexer for legal reasons.
 *
 * The status alone identifies it: the Transaction Service answers every
 * Safe-scoped endpoint with {@link UNAVAILABLE_FOR_LEGAL_REASONS_STATUS} when
 * the Safe is banned.
 *
 * @see https://github.com/safe-global/safe-transaction-service/pull/2966
 */
export function isBannedSafeError(
  error: unknown,
): error is NetworkResponseError {
  return (
    error instanceof NetworkResponseError &&
    error.response.status === UNAVAILABLE_FOR_LEGAL_REASONS_STATUS
  );
}

/**
 * Rewrites the payload of a banned-Safe response so that `HttpErrorFactory`
 * forwards a client-facing message alongside its status.
 *
 * The Transaction Service reports the reason under `detail`, and
 * `HttpErrorFactory` only reads `message`, so without this the client would
 * receive the status alongside a generic message.
 *
 * Any other error is returned untouched.
 */
export function mapBannedSafeError(error: unknown): unknown {
  if (isBannedSafeError(error)) {
    return new NetworkResponseError(error.url, error.response, {
      message: UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
    });
  }
  return error;
}
