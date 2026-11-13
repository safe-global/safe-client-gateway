// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ArgumentsHost,
  BadGatewayException,
  Catch,
  ConflictException,
  type ExceptionFilter,
  ForbiddenException,
  type HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { BillingUnavailableError } from '#/modules/spaces/domain/setup/errors/billing-unavailable.error';
import { NotEnoughSeatsError } from '#/modules/spaces/domain/setup/errors/not-enough-seats.error';
import { PlanNotOfferedError } from '#/modules/spaces/domain/setup/errors/plan-not-offered.error';
import { PlanRequiredError } from '#/modules/spaces/domain/setup/errors/plan-required.error';
import { SpaceSetupCheckoutFailedError } from '#/modules/spaces/domain/setup/errors/space-setup-checkout-failed.error';

type SpaceSetupError =
  | BillingUnavailableError
  | PlanRequiredError
  | PlanNotOfferedError
  | NotEnoughSeatsError
  | SpaceSetupCheckoutFailedError;

/** Maps the Workspace setup's domain errors to the setup routes' answers. */
@Catch(
  BillingUnavailableError,
  PlanRequiredError,
  PlanNotOfferedError,
  NotEnoughSeatsError,
  SpaceSetupCheckoutFailedError,
)
export class SpaceSetupExceptionFilter implements ExceptionFilter {
  public catch(exception: SpaceSetupError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const httpException = this.toHttpException(exception);

    response
      .status(httpException.getStatus())
      .send(httpException.getResponse());
  }

  private toHttpException(exception: SpaceSetupError): HttpException {
    if (exception instanceof SpaceSetupCheckoutFailedError) {
      return new BadGatewayException({
        statusCode: HttpStatus.BAD_GATEWAY,
        message: exception.message,
        spaceId: exception.spaceUuid,
      });
    }
    if (exception instanceof PlanNotOfferedError) {
      return new ForbiddenException(exception.message);
    }
    if (exception instanceof NotEnoughSeatsError) {
      return new ConflictException(exception.message);
    }
    return new UnprocessableEntityException(exception.message);
  }
}
