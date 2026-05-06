// SPDX-License-Identifier: FSL-1.1-MIT

/** Retryable email failure (e.g. throttling, network timeout).
 * BullMQ will retry with backoff. */
export class TransientEmailError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'TransientEmailError';
  }
}

/** Non-retryable email failure (e.g. rejected message, invalid address).
 * Throws {@link UnrecoverableError} in the consumer to stop retries. */
export class PermanentEmailError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'PermanentEmailError';
  }
}
