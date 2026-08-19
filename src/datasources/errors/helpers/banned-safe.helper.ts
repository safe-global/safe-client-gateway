// SPDX-License-Identifier: FSL-1.1-MIT
import {
  UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
  UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
} from '@/datasources/errors/constants';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';

/**
 * Rewrites the payload of a banned-Safe response so that `HttpErrorFactory`
 * forwards a client-facing message alongside its status.
 *
 * The Transaction Service answers every Safe-scoped endpoint with
 * {@link UNAVAILABLE_FOR_LEGAL_REASONS_STATUS} when the Safe is banned from
 * the indexer for legal reasons, reporting the reason under `detail`.
 * `HttpErrorFactory` only reads `message`, so without this the client would
 * receive the status alongside a generic message.
 *
 * Any other error is returned untouched.
 *
 * @see https://github.com/safe-global/safe-transaction-service/pull/2966
 */
export function mapBannedSafeError(error: unknown): unknown {
  if (
    error instanceof NetworkResponseError &&
    error.response.status === UNAVAILABLE_FOR_LEGAL_REASONS_STATUS
  ) {
    return new NetworkResponseError(error.url, error.response, {
      message: UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
    });
  }
  return error;
}
