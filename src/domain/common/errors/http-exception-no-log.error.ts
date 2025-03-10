import { HttpException } from '@nestjs/common';
import type { HttpStatus } from '@nestjs/common';

/**
 * The following errors combine with out {@link GlobalErrorFilter} to prevent
 * logging if thrown. This is because {@link GlobalErrorFilter} catches all
 * errors and logs them, but we may want to manually log
 */
export class HttpExceptionNoLog extends HttpException {
  constructor(message: string, code: HttpStatus) {
    // Create body in a similar fashion to code-specific exceptions
    // @see https://github.com/nestjs/nest/blob/3eaa07ae17245c43732c852084928012c745fa71/packages/common/exceptions/bad-gateway.exception.ts#L44-L49
    super(HttpExceptionNoLog.createBody(message, undefined!, code), code);
  }
}
