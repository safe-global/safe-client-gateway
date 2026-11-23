// SPDX-License-Identifier: FSL-1.1-MIT
import type { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common';

/**
 * The following errors combine with out {@link GlobalErrorFilter} to prevent
 * logging if thrown. This is because {@link GlobalErrorFilter} catches all
 * errors and logs them, but we may want to manually log
 */
export class HttpExceptionNoLog extends HttpException {
  /**
   * @param error - optional label for the body's `error` field, e.g.
   * `Unauthorized`, to answer with the same body as the code-specific exception
   */
  constructor(message: string, code: HttpStatus, error?: string) {
    // Create body in a similar fashion to code-specific exceptions
    // @see https://github.com/nestjs/nest/blob/3eaa07ae17245c43732c852084928012c745fa71/packages/common/exceptions/bad-gateway.exception.ts#L44-L49
    super(
      error
        ? HttpExceptionNoLog.createBody(message, error, code)
        : HttpExceptionNoLog.createBody(
            message,
            undefined as unknown as string,
            code,
          ),
      code,
    );
  }
}
