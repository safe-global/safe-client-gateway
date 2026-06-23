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
        const response = context.switchToHttp().getResponse<FastifyReply>();
        if (!response.sent) {
          response.header('Cache-Control', 'no-cache');
        }
      }),
    );
  }
}
