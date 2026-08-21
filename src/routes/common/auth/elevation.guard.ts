// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AUTH_PAYLOAD_REQUEST_PROPERTY } from '@/routes/common/auth/auth-payload.request';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

/**
 * Message returned when a sensitive action needs a fresh second factor.
 * Clients match on it to tell "redo MFA" apart from a plain authorisation
 * failure and start the step-up flow at
 * `GET /v1/auth/oidc/authorize?elevate=true&redirect_url=...`.
 */
export const ELEVATION_REQUIRED_ERROR = 'elevation_required';

/**
 * Allows a sensitive action only when the session presented a second factor
 * recently — either at login (which is itself multi-factor) or through a
 * step-up round-trip. Must be listed after `AuthGuard`, which is what attaches
 * the session payload to the request.
 *
 * Sign-In-with-Ethereum sessions are exempt: they never pass through the OIDC
 * provider, so they carry no MFA proof and would otherwise be locked out of
 * Workspace administration entirely. Extending step-up to them is Milestone 3
 * (WA-2852), at which point the exemption below is what gets removed.
 *
 * Enforcement is off unless `features.mfaStepUp` is set. A client that cannot
 * yet turn a 403 `elevation_required` into a step-up round-trip would surface
 * it as an unrecoverable error, so the flag lets the gateway ship ahead of
 * those clients and lets an environment be rolled back without a revert.
 */
@Injectable()
export class ElevationGuard implements CanActivate {
  private readonly isEnabled: boolean;
  private readonly elevationWindowSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    this.isEnabled =
      configurationService.getOrThrow<boolean>('features.mfaStepUp');
    this.elevationWindowSeconds = configurationService.getOrThrow<number>(
      'auth.elevationWindowSeconds',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.isEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const payload = new AuthPayload(request[AUTH_PAYLOAD_REQUEST_PROPERTY]);

    // Safe only because an account is either OIDC or wallet, never both:
    // linking a wallet requires an already-wallet-authenticated session
    // (`assertSignerAddress`), and the one path that attaches an OIDC identity
    // to an existing row demands `extUserId IS NULL` on a PENDING row. If that
    // ever changes, an OIDC admin could sign in by wallet and reach every
    // gated action with no second factor.
    if (payload.isSiwe()) {
      return true;
    }

    if (!payload.hasFreshMfa(this.elevationWindowSeconds)) {
      // Not a ForbiddenException: a lapsed window is the expected steady state
      // once the elevation window is short relative to a session, so every
      // routine step-up would otherwise be logged at info with a stacktrace by
      // `GlobalErrorFilter`.
      throw new HttpExceptionNoLog(
        ELEVATION_REQUIRED_ERROR,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
