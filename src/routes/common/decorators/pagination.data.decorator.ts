// SPDX-License-Identifier: FSL-1.1-MIT
import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import {
  getRouteUrl,
  type HttpRequest,
} from '@/routes/common/http/http-request.utils';
import { PaginationData } from '@/routes/common/pagination/pagination.data';

/**
 * Route decorator which parses {@link PaginationData} from a
 * cursor query.
 *
 * If the cursor does not exist or is invalid a default one is returned instead
 */
export const PaginationDataDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PaginationData => {
    const request = ctx.switchToHttp().getRequest<HttpRequest>();
    return PaginationData.fromCursor(getRouteUrl(request));
  },
);
