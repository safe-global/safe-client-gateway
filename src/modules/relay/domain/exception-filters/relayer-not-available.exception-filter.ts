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
    const response = host.switchToHttp().getResponse<FastifyReply>();
    response.status(HttpStatus.FORBIDDEN).send({
      message: exception.message,
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}
