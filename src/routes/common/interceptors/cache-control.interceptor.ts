// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
// biome-ignore lint/suspicious/noDeprecatedImports: only multi-callback `tap` overloads are deprecated in rxjs; we use the single-observer signature.
import { type Observable, tap } from 'rxjs';

/**
 * This interceptor can be used to set the `Cache-Control` header to `no-cache`.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    return next.handle().pipe(
      tap(() => {
        const response: Response = context.switchToHttp().getResponse();
        // Respect a Cache-Control set by an inner interceptor or @Header
        // decorator. Without this guard, route-specific cache policies
        // (e.g. `immutable` on an immutable-row lookup) would be silently
        // downgraded to `no-cache` because the global tap runs last in
        // the chain.
        if (!(response.headersSent || response.getHeader('Cache-Control'))) {
          response.header('Cache-Control', 'no-cache');
        }
      }),
    );
  }
}
