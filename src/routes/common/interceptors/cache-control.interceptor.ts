// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
// biome-ignore lint/suspicious/noDeprecatedImports: only multi-callback `tap` overloads are deprecated in rxjs; we use the single-observer signature.
import { type Observable, tap } from 'rxjs';

/**
 * Applies `Cache-Control: no-cache` as the default for every route.
 *
 * Registered globally, so it is the outermost interceptor and its `tap` runs
 * after any route-level one. A route that opts into client caching therefore
 * has to be left alone here, or this default would overwrite it — hence the
 * `hasHeader` check.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<FastifyReply>();
        if (!(response.sent || response.hasHeader('Cache-Control'))) {
          response.header('Cache-Control', 'no-cache');
        }
      }),
    );
  }
}
