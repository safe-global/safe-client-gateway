// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { InvalidMultiSendError } from '@/modules/relay/domain/errors/invalid-multisend.error';

@Catch(InvalidMultiSendError)
export class InvalidMultiSendExceptionFilter implements ExceptionFilter {
  catch(error: InvalidMultiSendError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      message: error.message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
