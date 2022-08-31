import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PaginationData } from '../pagination/pagination.data';
import { getRouteUrl } from './utils';

/**
 * Route decorator which parses {@link PaginationData} from a
 * cursor query.
 *
 * If the cursor does not exist or is invalid null is returned instead
 */
export const PaginationDataDecorator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PaginationData | null => {
    const request = ctx.switchToHttp().getRequest();
    return PaginationData.fromCursor(getRouteUrl(request));
  },
);
