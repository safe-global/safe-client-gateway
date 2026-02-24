import { EventProtocolChangedError } from '@/modules/hooks/routes/errors/event-protocol-changed.error';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { type Response } from 'express';

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
