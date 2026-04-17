// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { RelayLimitReachedError } from '@/modules/relay/domain/errors/relay-limit-reached.error';

@Catch(RelayLimitReachedError)
export class RelayLimitReachedExceptionFilter implements ExceptionFilter {
  catch(exception: RelayLimitReachedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      message: `Relay limit reached for ${exception.address}`,
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    });
  }
}
