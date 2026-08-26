// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';

/**
 * Registered on gated routes so the rejection never reaches
 * `GlobalErrorFilter`, which would log a stacktrace for expected steady state.
 */
@Catch(QuotaExceededError)
export class QuotaExceededExceptionFilter implements ExceptionFilter {
  public catch(exception: QuotaExceededError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.PAYMENT_REQUIRED).send(exception.getResponse());
  }
}
