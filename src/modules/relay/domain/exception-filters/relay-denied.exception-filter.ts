// SPDX-License-Identifier: FSL-1.1-MIT
import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { RelayDeniedError } from '@/modules/relay/domain/errors/relay-denied.error';

@Catch(RelayDeniedError)
export class RelayDeniedExceptionFilter implements ExceptionFilter {
  catch(exception: RelayDeniedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.FORBIDDEN).json({
      message: exception.message,
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}
