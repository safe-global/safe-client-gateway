// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { FeatureNotGrantedError } from '@/modules/entitlements/domain/errors/feature-not-granted.error';

/**
 * Registered on gated routes so the rejection never reaches
 * `GlobalErrorFilter`, which would log a stacktrace for expected steady state.
 */
@Catch(FeatureNotGrantedError)
export class FeatureNotGrantedExceptionFilter implements ExceptionFilter {
  public catch(exception: FeatureNotGrantedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.PAYMENT_REQUIRED).send(exception.getResponse());
  }
}
