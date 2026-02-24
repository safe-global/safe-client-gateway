import { type Response } from 'express';
import {
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { InvalidMultiSendError } from '@/modules/relay/domain/errors/invalid-multisend.error';

@Catch(InvalidMultiSendError)
export class InvalidMultiSendExceptionFilter implements ExceptionFilter {
  catch(error: InvalidMultiSendError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      message: error.message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
