import { type Response } from 'express';
import {
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { InvalidTransferError } from '@/modules/relay/domain/errors/invalid-transfer.error';

@Catch(InvalidTransferError)
export class InvalidTransferExceptionFilter implements ExceptionFilter {
  catch(error: InvalidTransferError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      message: error.message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
