// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';

export const ELEVATION_REQUIRED_ERROR = 'elevation_required';

/**
 * Allows a sensitive action only when the session was multi-factor
 * authenticated recently (a fresh step-up round-trip through the OIDC
 * provider). Must run after {@link AuthGuard}, which attaches the session
 * payload to the request.
 *
 * Rejections use the distinct `elevation_required` message so clients can
 * distinguish "redo MFA" from a plain 403 and start the step-up flow
 * (`GET /v1/auth/oidc/authorize?elevate=true&redirect_url=...`).
 */
@Injectable()
export class ElevationGuard implements CanActivate {
  private readonly elevationWindowSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    this.elevationWindowSeconds = configurationService.getOrThrow<number>(
      'auth.elevationWindowSeconds',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();
    const payloadDto = request[AuthGuard.AUTH_PAYLOAD_REQUEST_PROPERTY];
    const payload = new AuthPayload(payloadDto);

    if (!payload.hasFreshMfa(this.elevationWindowSeconds)) {
      throw new ForbiddenException(ELEVATION_REQUIRED_ERROR);
    }

    return true;
  }
}
