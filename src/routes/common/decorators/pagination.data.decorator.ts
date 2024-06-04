import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getRouteUrl } from '@/routes/common/decorators/utils';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { Request } from 'express';

/**
 * Route decorator which parses {@link PaginationData} from a
 * cursor query.
 *
 * If the cursor does not exist or is invalid a default one is returned instead
 */
export const PaginationDataDecorator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PaginationData => {
    const request: Request = ctx.switchToHttp().getRequest();
    return PaginationData.fromCursor(getRouteUrl(request));
  },
);
