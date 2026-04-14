// SPDX-License-Identifier: FSL-1.1-MIT
import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { RelayTxDeniedError } from '@/modules/relay/domain/errors/relay-tx-denied.error';

@Catch(RelayTxDeniedError)
export class RelayTxDeniedExceptionFilter implements ExceptionFilter {
  catch(exception: RelayTxDeniedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.FORBIDDEN).json({
      message: exception.message,
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}
