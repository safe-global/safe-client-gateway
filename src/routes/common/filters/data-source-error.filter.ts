import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { Response } from 'express';

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
  catch(exception: DataSourceError, host: ArgumentsHost): any {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const code = exception.code ?? HttpStatus.SERVICE_UNAVAILABLE;

    response.status(code).json({
      code: code,
      message: exception.message,
    });
  }
}
