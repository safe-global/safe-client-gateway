// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DataSourceError } from '@/domain/errors/data-source.error';

/**
 * This {@link ExceptionFilter} catches any {@link DataSourceError} thrown
 * at the route level.
 *
 * It builds a JSON payload which contains a code and a message.
 * The code and message used are read from {@link DataSourceError}.
 *
 * If code is undefined, 503 is used instead.
 */
@Catch(DataSourceError)
export class DataSourceErrorFilter implements ExceptionFilter {
  catch(exception: DataSourceError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const code = exception.code ?? HttpStatus.SERVICE_UNAVAILABLE;

    response.status(code).send({
      code: code,
      message: exception.message,
    });
  }
}
