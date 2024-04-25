import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthPayload } from '@/routes/auth/entities/auth-payload.entity';

/**
 * Route decorator that extracts the {@link AuthPayload}
 */
export const AuthPayloadDecorator = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthPayload | undefined => {
    const request: Request = ctx.switchToHttp().getRequest();
    return request.auth;
  },
);
