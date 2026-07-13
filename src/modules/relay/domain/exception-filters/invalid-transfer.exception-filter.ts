// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { InvalidTransferError } from '@/modules/relay/domain/errors/invalid-transfer.error';

@Catch(InvalidTransferError)
export class InvalidTransferExceptionFilter implements ExceptionFilter {
  catch(error: InvalidTransferError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      message: error.message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
