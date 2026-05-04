// SPDX-License-Identifier: FSL-1.1-MIT
import { SesEmailErrorMapper } from '@/modules/email/ses/datasources/ses-email-error.mapper';
import {
  TransientEmailError,
  PermanentEmailError,
} from '@/modules/email/ses/domain/errors/email.errors';
import {
  AccountSuspendedException,
  BadRequestException,
  InternalServiceErrorException,
  LimitExceededException,
  MailFromDomainNotVerifiedException,
  MessageRejected,
  NotFoundException,
  SendingPausedException,
  TooManyRequestsException,
} from '@aws-sdk/client-sesv2';

describe('SesEmailErrorMapper', () => {
  describe('transient SES errors', () => {
    it.each([
      {
        ExceptionClass: TooManyRequestsException,
        name: 'TooManyRequestsException',
      },
      {
        ExceptionClass: LimitExceededException,
        name: 'LimitExceededException',
      },
    ])('should return TransientEmailError for $name', ({ ExceptionClass }) => {
      const error = new ExceptionClass({
        message: 'throttled',
        $metadata: {},
      });

      const result = SesEmailErrorMapper.fromSesError(error);

      expect(result).toBeInstanceOf(TransientEmailError);
      expect(result.cause).toBe(error);
    });

    it('should return TransientEmailError for server-fault errors', () => {
      const error = new InternalServiceErrorException({
        message: 'internal error',
        $metadata: {},
      });

      const result = SesEmailErrorMapper.fromSesError(error);

      expect(result).toBeInstanceOf(TransientEmailError);
    });

    it('should return TransientEmailError for non-SES errors (network/timeout)', () => {
      const error = new Error('socket hang up');

      const result = SesEmailErrorMapper.fromSesError(error);

      expect(result).toBeInstanceOf(TransientEmailError);
      expect(result.cause).toBe(error);
    });

    it('should return TransientEmailError for errors with $retryable trait', () => {
      const error = new BadRequestException({
        message: 'retryable',
        $metadata: {},
      });
      // Simulate SDK setting $retryable
      Object.defineProperty(error, '$retryable', {
        value: { throttling: false },
      });

      const result = SesEmailErrorMapper.fromSesError(error);

      expect(result).toBeInstanceOf(TransientEmailError);
    });

    it.each([408, 429, 500, 502, 503, 504])(
      'should return TransientEmailError for HTTP status %s',
      (statusCode) => {
        const error = new BadRequestException({
          message: 'server error',
          $metadata: { httpStatusCode: statusCode },
        });

        const result = SesEmailErrorMapper.fromSesError(error);

        expect(result).toBeInstanceOf(TransientEmailError);
      },
    );
  });

  describe('permanent SES errors', () => {
    it.each([
      { ExceptionClass: MessageRejected, name: 'MessageRejected' },
      {
        ExceptionClass: MailFromDomainNotVerifiedException,
        name: 'MailFromDomainNotVerifiedException',
      },
      { ExceptionClass: BadRequestException, name: 'BadRequestException' },
      { ExceptionClass: NotFoundException, name: 'NotFoundException' },
      {
        ExceptionClass: AccountSuspendedException,
        name: 'AccountSuspendedException',
      },
      {
        ExceptionClass: SendingPausedException,
        name: 'SendingPausedException',
      },
    ])('should return PermanentEmailError for $name', ({ ExceptionClass }) => {
      const error = new ExceptionClass({
        message: 'rejected',
        $metadata: {},
      });

      const result = SesEmailErrorMapper.fromSesError(error);

      expect(result).toBeInstanceOf(PermanentEmailError);
      expect(result.cause).toBe(error);
    });
  });

  describe('error message', () => {
    it('should include the original error message', () => {
      const error = new Error('connection reset');

      const result = SesEmailErrorMapper.fromSesError(error);

      expect(result.message).toContain('connection reset');
    });

    it('should handle non-Error objects as unknown errors', () => {
      const result = SesEmailErrorMapper.fromSesError('string error');

      expect(result.message).toContain('Unknown SES error');
      expect(result.cause).toBeUndefined();
    });
  });
});
