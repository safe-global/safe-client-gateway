// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
// biome-ignore lint/suspicious/noDeprecatedImports: only the `thisArg` overloads are deprecated in rxjs; we use the single-argument `map` signature.
import { map, type Observable } from 'rxjs';

/**
 * NestJS' Fastify adapter serializes a `null` controller return value to the
 * literal response body `null`, whereas the previous Express adapter emitted an
 * empty body. This interceptor maps a top-level `null` result to `undefined` so
 * Fastify sends an empty body, preserving the pre-migration HTTP contract (e.g.
 * endpoints that pass through an empty upstream response).
 */
@Injectable()
export class NullResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(map((data) => (data === null ? undefined : data)));
  }
}
