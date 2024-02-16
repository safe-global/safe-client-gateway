import { RelayLimitReachedError } from '@/domain/relay/errors/relay-limit-reached.error';
import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';

@Catch(RelayLimitReachedError)
export class RelayLimitReachedExceptionFilter implements ExceptionFilter {
  catch(exception: RelayLimitReachedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      message: `Relay limit reached for ${exception.address}`,
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    });
  }
}
