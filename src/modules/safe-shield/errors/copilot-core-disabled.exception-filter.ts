// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { CopilotCoreDisabledError } from '@/modules/safe-shield/errors/copilot-core-disabled.error';

/**
 * Registered on the disabled Core routes so the rejection never reaches
 * `GlobalErrorFilter`, which would log a stacktrace for expected steady state.
 */
@Catch(CopilotCoreDisabledError)
export class CopilotCoreDisabledExceptionFilter implements ExceptionFilter {
  public catch(exception: CopilotCoreDisabledError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.PAYMENT_REQUIRED).send(exception.getResponse());
  }
}
