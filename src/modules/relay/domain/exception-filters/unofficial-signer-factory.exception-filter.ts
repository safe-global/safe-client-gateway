// SPDX-License-Identifier: FSL-1.1-MIT

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { UnofficialSignerFactoryError } from '@/modules/relay/domain/errors/unofficial-signer-factory.error';

@Catch(UnofficialSignerFactoryError)
export class UnofficialSignerFactoryExceptionFilter implements ExceptionFilter {
  catch(_: UnofficialSignerFactoryError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      message: 'Unofficial SafeWebAuthnSignerFactory contract.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
