// SPDX-License-Identifier: FSL-1.1-MIT

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { ACCESS_TOKEN_COOKIE_NAME } from '@/modules/auth/utils/auth-cookie.utils';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly authGuard: AuthGuard) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HttpRequest>();

    const accessToken: string | undefined =
      request.cookies?.[ACCESS_TOKEN_COOKIE_NAME];

    /**
     * If there is no access token, we allow the request to proceed as
     * we may have public/private access on the same route.
     */
    if (!accessToken) {
      return true;
    }

    return this.authGuard.canActivate(context);
  }
}
