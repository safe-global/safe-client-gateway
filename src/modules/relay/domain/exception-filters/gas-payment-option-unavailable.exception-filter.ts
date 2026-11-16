// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { GasPaymentOptionUnavailableError } from '#/modules/relay/domain/errors/gas-payment-option-unavailable.error';

/** An expected refusal: kept away from `GlobalErrorFilter`'s logging. */
@Catch(GasPaymentOptionUnavailableError)
export class GasPaymentOptionUnavailableExceptionFilter
  implements ExceptionFilter
{
  public catch(
    exception: GasPaymentOptionUnavailableError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.CONFLICT).send(exception.getResponse());
  }
}
