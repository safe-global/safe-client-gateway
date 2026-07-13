// SPDX-License-Identifier: FSL-1.1-MIT
import type { ArgumentsHost } from '@nestjs/common';
import { Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { SafeTxHashMismatchError } from '@/modules/relay/domain/errors/safe-tx-hash-mismatch.error';

@Catch(SafeTxHashMismatchError)
export class SafeTxHashMismatchExceptionFilter implements ExceptionFilter {
  catch(error: SafeTxHashMismatchError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      message: error.message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
