// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { UnofficialMasterCopyError } from '@/modules/relay/domain/errors/unofficial-master-copy.error';

@Catch(UnofficialMasterCopyError)
export class UnofficialMasterCopyExceptionFilter implements ExceptionFilter {
  catch(_: UnofficialMasterCopyError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      message: 'Unsupported base contract.',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
