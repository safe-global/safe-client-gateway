import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';

@Catch(UniqueConstraintError)
export class UniqueConstraintExceptionFilter implements ExceptionFilter {
  catch(error: UniqueConstraintError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.CONFLICT).json({
      message: error.message,
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
