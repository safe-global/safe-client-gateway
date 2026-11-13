// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { InvalidSurveySelectionsError } from '#/modules/surveys/domain/errors/invalid-survey-selections.error';

/** Answers selections that do not fit the survey with a 400. */
@Catch(InvalidSurveySelectionsError)
export class InvalidSurveySelectionsExceptionFilter implements ExceptionFilter {
  public catch(
    exception: InvalidSurveySelectionsError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const httpException = new BadRequestException(exception.message);

    response
      .status(httpException.getStatus())
      .send(httpException.getResponse());
  }
}
