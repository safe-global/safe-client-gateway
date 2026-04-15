// SPDX-License-Identifier: FSL-1.1-MIT
import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { RelayDeniedError } from '@/modules/relay/domain/errors/relay-denied.error';
import { RelayTxDeniedError } from '@/modules/relay/domain/errors/relay-tx-denied.error';

@Catch(RelayDeniedError, RelayTxDeniedError)
export class RelayDeniedExceptionFilter implements ExceptionFilter {
  catch(
    exception: RelayDeniedError | RelayTxDeniedError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.FORBIDDEN).json({
      message: exception.message,
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}
