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
 * Renders `QuotaExceededError` as the typed `402 QUOTA_EXCEEDED` body
 * (`QuotaExceededErrorResponse`) so clients can branch on `code` and drive
 * upgrade flows from `feature`/`quota`/`used`/`resetsAt`.
 */
@Catch(QuotaExceededError)
export class QuotaExceededExceptionFilter implements ExceptionFilter {
  public catch(exception: QuotaExceededError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.PAYMENT_REQUIRED).send({
      code: 'QUOTA_EXCEEDED',
      message: exception.message,
      statusCode: HttpStatus.PAYMENT_REQUIRED,
      feature: exception.feature,
      quota: exception.quota,
      used: exception.used,
      resetsAt: exception.resetsAt?.toISOString() ?? null,
    });
  }
}
