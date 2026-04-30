// SPDX-License-Identifier: FSL-1.1-MIT
import {
  PermanentEmailError,
  TransientEmailError,
} from '@/modules/email/ses/domain/errors/email.errors';
import {
  LimitExceededException,
  SESv2ServiceException,
  TooManyRequestsException,
} from '@aws-sdk/client-sesv2';

export class SesEmailErrorMapper {
  static fromSesError(
    error: unknown,
  ): TransientEmailError | PermanentEmailError {
    const message = this.getMessage(error);
    const cause = error instanceof Error ? error : undefined;

    if (this.isTransientSesError(error)) {
      return new TransientEmailError(
        `AWS SES transient failure: ${message}`,
        cause,
      );
    }

    return new PermanentEmailError(`AWS SES rejected: ${message}`, cause);
  }

  private static isTransientSesError(error: unknown): boolean {
    if (!(error instanceof SESv2ServiceException)) {
      /**
       * Non-SES errors are usually transport/runtime errors:
       * DNS failure, socket timeout, connection reset, etc.
       *
       * Treat them as retryable.
       */
      return true;
    }

    const statusCode = error.$metadata?.httpStatusCode;

    // Note: AccountSuspendedException and SendingPausedException are intentionally
    // treated as permanent — they require human/ops intervention and won't resolve
    // within BullMQ retry windows.
    return Boolean(
      error instanceof TooManyRequestsException ||
      error instanceof LimitExceededException ||
      error.$retryable ||
      error.$fault === 'server' ||
      statusCode === 408 ||
      statusCode === 429 ||
      (statusCode !== undefined && statusCode >= 500),
    );
  }

  private static getMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown SES error';
  }
}
