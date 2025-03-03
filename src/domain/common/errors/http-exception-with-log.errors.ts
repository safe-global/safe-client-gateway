import { HttpException } from '@nestjs/common';
import type { HttpStatus } from '@nestjs/common';

/**
 * The following errors combine with out {@link GlobalErrorFilter} to prevent
 * being toggle logging if thrown. This is because the {@link GlobalErrorFilter}
 * will catch the error and log it, and we might have logging where thrown.
 */
export class HttpExceptionWithLog extends HttpException {
  public log: boolean;

  constructor(args: { message: string; code: HttpStatus; log: boolean }) {
    super(args.message, args.code);
    this.log = args.log;
  }
}
