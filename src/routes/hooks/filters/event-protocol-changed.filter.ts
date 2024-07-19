import { EventProtocolChangedError } from '@/routes/hooks/errors/event-protocol-changed.error';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(EventProtocolChangedError)
export class EventProtocolChangedFilter implements ExceptionFilter {
  catch(_: EventProtocolChangedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.GONE).json({
      message: 'Unsupported protocol for this kind of event',
      statusCode: HttpStatus.GONE,
    });
  }
}
