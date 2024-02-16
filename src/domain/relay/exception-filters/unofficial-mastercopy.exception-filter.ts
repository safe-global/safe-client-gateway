import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { UnofficialMastercopyError } from '@/domain/relay/errors/unofficial-mastercopy.error';

@Catch(UnofficialMastercopyError)
export class UnofficialMastercopyExceptionFilter implements ExceptionFilter {
  catch(_: UnofficialMastercopyError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      message: 'Unsupported base contract.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
