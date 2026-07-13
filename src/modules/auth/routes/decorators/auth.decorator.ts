import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';

/**
 * Route decorator that extracts the {@link AuthPayload}
 */
export const Auth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthPayload => {
    const request: Request = ctx.switchToHttp().getRequest();
    return new AuthPayload(request[AuthGuard.AUTH_PAYLOAD_REQUEST_PROPERTY]);
  },
);
