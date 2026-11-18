// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus } from '@nestjs/common';
import { DataSourceError } from '#/domain/errors/data-source.error';

function isQueueUnavailable(error: unknown): error is DataSourceError {
  return (
    error instanceof DataSourceError &&
    error.code !== undefined &&
    (error.code === HttpStatus.TOO_MANY_REQUESTS ||
      error.code >= HttpStatus.INTERNAL_SERVER_ERROR)
  );
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof DataSourceError && error.code === HttpStatus.NOT_FOUND
  );
}

/**
 * The error to throw when reading a transaction from the queue service failed
 * and the transaction service fallback failed too.
 *
 * A pending transaction only exists in the queue service, so the fallback's
 * 404 is not proof that it is missing while the queue was rate limited or
 * down (429 or 5xx): the queue's error is the true answer then.
 */
export function getQueueFallbackError(args: {
  queueError: unknown;
  txServiceError: unknown;
}): unknown {
  return isQueueUnavailable(args.queueError) && isNotFound(args.txServiceError)
    ? args.queueError
    : args.txServiceError;
}
