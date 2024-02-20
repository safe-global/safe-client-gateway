import { Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { UnofficialMasterCopyError } from '@/domain/relay/errors/unofficial-master-copy.error';

@Catch(UnofficialMasterCopyError)
export class UnofficialMasterCopyExceptionFilter implements ExceptionFilter {
  catch(_: UnofficialMasterCopyError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      message: 'Unsupported base contract.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
