// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { TooManyInvitesError } from '#/modules/users/domain/members/errors/too-many-invites.error';

/** Answers an invite batch over the limit with a 409. */
@Catch(TooManyInvitesError)
export class TooManyInvitesExceptionFilter implements ExceptionFilter {
  public catch(exception: TooManyInvitesError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const httpException = new ConflictException(exception.message);

    response
      .status(httpException.getStatus())
      .send(httpException.getResponse());
  }
}
