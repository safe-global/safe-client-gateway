// SPDX-License-Identifier: FSL-1.1-MIT
import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

/**
 * Route decorator that extracts the {@link AuthPayload}
 */
export const Auth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthPayload => {
    const request = ctx.switchToHttp().getRequest<HttpRequest>();
    return new AuthPayload(request[AuthGuard.AUTH_PAYLOAD_REQUEST_PROPERTY]);
  },
);
