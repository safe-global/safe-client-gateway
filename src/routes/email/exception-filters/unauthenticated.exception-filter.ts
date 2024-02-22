import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * The UnauthenticatedExceptionFilter can be used on routes which are not
 * authenticated.
 *
 * When used, this exception filter would catch any instance of {@link Error}
 * and return to the clients the provided status code with an empty body.
 *
 * This is specially useful for unauthenticated routes which need to provide
 * feedback to the clients on a successful response while masking all errors
 * under one response.
 */
@Catch(Error)
export class UnauthenticatedExceptionFilter implements ExceptionFilter {
  constructor(private readonly statusCode: HttpStatus) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(this.statusCode).json();
  }
}
