import { EditTimespanError } from '@/domain/email/errors/email-timespan.error';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(EditTimespanError)
export class EmailEditTimespanExceptionFilter implements ExceptionFilter {
  catch(exception: EditTimespanError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      message: 'Cannot edit at this time',
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    });
  }
}
