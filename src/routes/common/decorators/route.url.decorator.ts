import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { getRouteUrl } from '@/routes/common/decorators/utils';
import type { Request } from 'express';

/**
 * Route decorator which extracts the resulting
 * route {@link URL}
 */
export const RouteUrlDecorator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): URL => {
    const request: Request = ctx.switchToHttp().getRequest();
    return getRouteUrl(request);
  },
);
