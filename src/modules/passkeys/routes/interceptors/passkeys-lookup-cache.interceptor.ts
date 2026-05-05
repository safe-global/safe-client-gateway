// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
// biome-ignore lint/suspicious/noDeprecatedImports: only the multi-callback tap overloads are deprecated.
import { catchError, type Observable, tap, throwError } from 'rxjs';

const HIT_CACHE_CONTROL = 'public, max-age=86400, s-maxage=2592000, immutable';
const MISS_CACHE_CONTROL = 'no-store';

/**
 * Sets the GET-endpoint cache headers per the plan:
 *   - 200 → public, long-TTL, immutable
 *   - 4xx (404 / 400) → no-store, to avoid stale-negative cache that would
 *     lock first-launch flows after a brand-new POST lands at the origin
 *
 * Replaces the global CacheControlInterceptor for this route only — the
 * interceptor is wired via @UseInterceptors at the handler level.
 */
@Injectable()
export class PasskeysLookupCacheInterceptor implements NestInterceptor {
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        if (!response.headersSent) {
          response.setHeader('Cache-Control', HIT_CACHE_CONTROL);
        }
      }),
      catchError((err: unknown) => {
        if (!response.headersSent) {
          response.setHeader('Cache-Control', MISS_CACHE_CONTROL);
        }
        return throwError(() => err);
      }),
    );
  }
}
