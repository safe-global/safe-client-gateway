import { type Response } from 'express';
import {
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { UnofficialMultiSendError } from '@/modules/relay/domain/errors/unofficial-multisend.error';

@Catch(UnofficialMultiSendError)
export class UnofficialMultiSendExceptionFilter implements ExceptionFilter {
  catch(_: UnofficialMultiSendError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      message: 'Unofficial MultiSend contract.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
