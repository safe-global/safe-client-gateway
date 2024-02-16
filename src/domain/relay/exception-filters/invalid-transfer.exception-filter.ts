import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { InvalidTransferError } from '@/domain/relay/errors/invalid-transfer.error';

@Catch(InvalidTransferError)
export class InvalidTransferExceptionFilter implements ExceptionFilter {
  catch(_: InvalidTransferError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid transfer.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
