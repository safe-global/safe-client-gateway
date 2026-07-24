// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import type { AuthPayloadDto } from '@/modules/auth/domain/entities/auth-payload.entity';
import { ACCESS_TOKEN_COOKIE_NAME } from '@/modules/auth/utils/auth-cookie.utils';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

declare module 'fastify' {
  interface FastifyRequest {
    [AuthGuard.AUTH_PAYLOAD_REQUEST_PROPERTY]?: AuthPayloadDto;
  }
}

/**
 * The AuthGuard should be used to protect routes that require authentication.
 *
 * It checks for the presence of a valid JWT access token in the request and
 * verifies its validity before adding the parsed payload back to the request
 * and allowing access to the route.
 *
 * 1. Check for the presence of an access token in the request.
 * 2. Verify the token's validity.
 * 3. If valid, allow access.
 */

@Injectable()
export class AuthGuard implements CanActivate {
  static readonly AUTH_PAYLOAD_REQUEST_PROPERTY = 'accessToken';

  constructor(
    @Inject(IAuthRepository) private readonly authRepository: IAuthRepository,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HttpRequest>();

    const accessToken: string | undefined =
      request.cookies?.[ACCESS_TOKEN_COOKIE_NAME];

    // No token in the request
    if (!accessToken) {
      return false;
    }

    try {
      request[AuthGuard.AUTH_PAYLOAD_REQUEST_PROPERTY] =
        this.authRepository.verifyToken(accessToken);
      return true;
    } catch {
      return false;
    }
  }
}
