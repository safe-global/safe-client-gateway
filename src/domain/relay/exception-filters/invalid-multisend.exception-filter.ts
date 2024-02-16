import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { InvalidMultiSendError } from '@/domain/relay/errors/invalid-multisend.error';

@Catch(InvalidMultiSendError)
export class InvalidMultiSendExceptionFilter implements ExceptionFilter {
  catch(_: InvalidMultiSendError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid batch.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
