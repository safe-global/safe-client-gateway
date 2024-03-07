import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { ZodError, ZodIssue } from 'zod';
import { Response } from 'express';

/**
 * This {@link ExceptionFilter} catches any {@link ZodError} thrown
 * at the route level.
 *
 * It builds a JSON payload which contains a code and a message.
 * The code and message used are read from {@link ZodError} issues.
 */
@Catch(ZodError)
export class ZodErrorFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const error = this.mapZodErrorResponse(exception);

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      ...error,
    });
  }

  private mapZodErrorResponse(exception: ZodError): ZodIssue {
    return exception.issues[0].code === 'invalid_union'
      ? this.mapZodErrorResponse(exception.issues[0].unionErrors[0])
      : exception.issues[0];
  }
}
