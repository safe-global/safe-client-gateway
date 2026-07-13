// SPDX-License-Identifier: FSL-1.1-MIT
import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import {
  getRouteUrl,
  type HttpRequest,
} from '@/routes/common/http/http-request.utils';

/**
 * Route decorator which extracts the resulting
 * route {@link URL}
 */
export const RouteUrlDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): URL => {
    const request = ctx.switchToHttp().getRequest<HttpRequest>();
    return getRouteUrl(request);
  },
);
