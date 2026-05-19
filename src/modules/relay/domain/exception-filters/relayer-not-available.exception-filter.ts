// SPDX-License-Identifier: FSL-1.1-MIT

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { NoRelayerDefinedError } from '@/modules/relay/domain/errors/no-relayer-defined.error';
import { RelayerTypeNotImplementedError } from '@/modules/relay/domain/errors/relayer-type-not-implemented.error';

@Catch(NoRelayerDefinedError, RelayerTypeNotImplementedError)
export class RelayerNotAvailableExceptionFilter implements ExceptionFilter {
  catch(
    exception: NoRelayerDefinedError | RelayerTypeNotImplementedError,
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
