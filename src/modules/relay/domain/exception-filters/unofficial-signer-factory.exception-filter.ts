// SPDX-License-Identifier: FSL-1.1-MIT
import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { UnofficialSignerFactoryError } from '@/modules/relay/domain/errors/unofficial-signer-factory.error';

@Catch(UnofficialSignerFactoryError)
export class UnofficialSignerFactoryExceptionFilter implements ExceptionFilter {
  catch(_: UnofficialSignerFactoryError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      message: 'Unofficial SafeWebAuthnSignerFactory contract.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
