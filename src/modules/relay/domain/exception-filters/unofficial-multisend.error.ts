// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
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
