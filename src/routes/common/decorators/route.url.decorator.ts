import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getRouteUrl } from './utils';

/**
 * Route decorator which extracts the resulting
 * route {@link URL}
 */
export const RouteUrlDecorator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): URL => {
    const request = ctx.switchToHttp().getRequest();
    return getRouteUrl(request);
  },
);
