import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';

/**
 * Route decorator that extracts the {@link AuthPayload}
 */
export const Auth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthPayload | undefined => {
    const request: Request = ctx.switchToHttp().getRequest();
    return request[AuthGuard.AUTH_PAYLOAD_REQUEST_PROPERTY];
  },
);
