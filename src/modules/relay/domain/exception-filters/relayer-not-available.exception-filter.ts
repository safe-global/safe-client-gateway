// SPDX-License-Identifier: FSL-1.1-MIT

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { NoRelayerDefinedError } from '@/modules/relay/domain/errors/no-relayer-defined.error';

@Catch(NoRelayerDefinedError)
export class RelayerNotAvailableExceptionFilter implements ExceptionFilter {
  catch(exception: NoRelayerDefinedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const statusCode = HttpStatus.FORBIDDEN;

    response.status(statusCode).send({
      message: exception.message,
      statusCode,
    });
  }
}
