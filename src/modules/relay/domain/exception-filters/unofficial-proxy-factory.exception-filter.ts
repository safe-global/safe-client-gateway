// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { UnofficialProxyFactoryError } from '@/modules/relay/domain/errors/unofficial-proxy-factory.error';

@Catch(UnofficialProxyFactoryError)
export class UnofficialProxyFactoryExceptionFilter implements ExceptionFilter {
  catch(_: UnofficialProxyFactoryError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      message: 'Unofficial ProxyFactory contract.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
