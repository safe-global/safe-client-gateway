// SPDX-License-Identifier: FSL-1.1-MIT
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { TOTP_TOKEN_COOKIE_NAME } from '@/modules/totp/totp.constants';

/**
 * Allows a sensitive action only if the request carries a valid TOTP elevation
 * token bound to the authenticated session. Must run after {@link AuthGuard},
 * which attaches the session payload. Validation is signature-only: no DB.
 */
@Injectable()
export class TotpGuard implements CanActivate {
  constructor(
    @Inject(IAuthRepository)
    private readonly authRepository: IAuthRepository,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();

    const elevationToken: string | undefined =
      request.cookies[TOTP_TOKEN_COOKIE_NAME];
    if (!elevationToken) {
      throw new UnauthorizedException('TOTP elevation required');
    }

    let elevatedUserId: string;
    try {
      ({ userId: elevatedUserId } =
        this.authRepository.verifyTotpElevationToken(elevationToken));
    } catch {
      throw new UnauthorizedException('TOTP elevation required');
    }

    const session = request[AuthGuard.AUTH_PAYLOAD_REQUEST_PROPERTY] as
      | { sub?: string }
      | undefined;
    if (!session || session.sub !== elevatedUserId) {
      throw new UnauthorizedException('TOTP elevation required');
    }

    return true;
  }
}
