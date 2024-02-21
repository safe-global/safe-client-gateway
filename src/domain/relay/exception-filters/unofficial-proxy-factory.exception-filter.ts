import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { UnofficialProxyFactoryError } from '@/domain/relay/errors/unofficial-proxy-factory.error';

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
