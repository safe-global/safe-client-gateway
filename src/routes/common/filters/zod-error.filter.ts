import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { ZodError, z } from 'zod';
import { Response } from 'express';
import { ZodErrorWithCode } from '@/validation/pipes/validation.pipe';

/**
 * This {@link ExceptionFilter} catches any {@link ZodError} thrown from
 * the domain or {@link ZodErrorWithCode} thrown at the route level.
 *
 * It builds a JSON payload which contains a code and a message.
 * The message is read from the initial {@link z.core.$ZodIssue} and the code
 * from {@link ZodErrorWithCode.code} or 502 if {@link ZodError}.
 */
@Catch(ZodError, ZodErrorWithCode)
export class ZodErrorFilter implements ExceptionFilter {
  catch(exception: ZodError | ZodErrorWithCode, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof ZodErrorWithCode) {
      const code = exception.code;
      const error = this.mapZodErrorResponse(exception);

      response.status(code).json({
        statusCode: code,
        ...error,
      });
    } else {
      // Don't expose validation as it may contain sensitive data
      response.status(HttpStatus.BAD_GATEWAY).json({
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'Bad gateway',
      });
    }
  }

  private mapZodErrorResponse(exception: ZodError): z.core.$ZodIssue {
    const firstIssue = exception.issues[0];
    if (
      firstIssue.code === 'invalid_union' &&
      'error' in firstIssue &&
      firstIssue.error instanceof ZodError
    ) {
      return this.mapZodErrorResponse(firstIssue.error);
    }
    return firstIssue;
  }
}
