import { HttpException } from '@nestjs/common';
import type { HttpStatus } from '@nestjs/common';

/**
 * The following errors combine with out {@link GlobalErrorFilter} to prevent
 * logging if thrown. This is because {@link GlobalErrorFilter} catches all
 * errors and logs them, but we may want to manually log
 */
export class HttpExceptionNoLog extends HttpException {
  constructor(message: string, code: HttpStatus) {
    super(HttpExceptionNoLog.createBody(message, undefined!, code), code);
  }
}
