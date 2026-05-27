// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
// biome-ignore lint/suspicious/noDeprecatedImports: only the multi-callback tap overloads are deprecated.
import { catchError, type Observable, tap, throwError } from 'rxjs';
import { IConfigurationService } from '@/config/configuration.service.interface';

const MISS_CACHE_CONTROL = 'no-store';

/**
 * Sets the GET-endpoint cache headers per the plan:
 *   - 200 → public, long-TTL, immutable
 *   - 4xx (404 / 400) → no-store, to avoid stale-negative cache that would
 *     lock first-launch flows after a brand-new POST lands at the origin
 *
 * The global CacheControlInterceptor defaults to `no-cache`, which is the
 * right policy for almost every endpoint but wrong for this one: passkey
 * rows are immutable (`credentialId` is the PK and never mutates), so the
 * 200 response is safe to cache aggressively. TTLs are read from
 * configuration so they can be tuned per environment without a code change.
 * The interceptor is wired via @UseInterceptors at the handler level.
 */
@Injectable()
export class PasskeysLookupCacheInterceptor implements NestInterceptor {
  private readonly hitCacheControl: string;

  public constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    const maxAge = configurationService.getOrThrow<number>(
      'passkeys.lookupCache.hitMaxAgeSeconds',
    );
    const sMaxAge = configurationService.getOrThrow<number>(
      'passkeys.lookupCache.hitSharedMaxAgeSeconds',
    );
    this.hitCacheControl = `public, max-age=${maxAge}, s-maxage=${sMaxAge}, immutable`;
  }

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        if (!response.headersSent) {
          response.setHeader('Cache-Control', this.hitCacheControl);
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
