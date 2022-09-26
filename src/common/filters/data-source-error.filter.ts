import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { DataSourceError } from '../../domain/errors/data-source.error';
import { Response } from 'express';

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
