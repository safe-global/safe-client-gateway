// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
// biome-ignore lint/suspicious/noDeprecatedImports: only multi-callback `tap` overloads are deprecated in rxjs; we use the single-observer signature.
import { type Observable, tap } from 'rxjs';
import { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * Lets clients serve `GET /v1/chains/:chainId/safes/:safeAddress` from their
 * own HTTP cache for a short window instead of re-requesting it.
 *
 * Clients poll this route on a fixed interval, so a `max-age` drops most of
 * those repeat requests before they are sent. `private` scopes the caching to
 * the requesting client, so no intermediary keeps a copy.
 *
 * A max-age at or below the client polling interval saves nothing, because
 * every poll finds the entry already stale. `0` omits the header and leaves
 * the global default in place.
 */
@Injectable()
export class SafeStateCacheControlInterceptor implements NestInterceptor {
  private readonly maxAgeSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    this.maxAgeSeconds = configurationService.getOrThrow<number>(
      'clientCacheControl.safeStateMaxAgeSeconds',
    );
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    return next.handle().pipe(
      tap(() => {
        if (this.maxAgeSeconds <= 0) {
          return;
        }
        const response = context.switchToHttp().getResponse<FastifyReply>();
        if (!response.sent) {
          response.header(
            'Cache-Control',
            `private, max-age=${this.maxAgeSeconds}`,
          );
        }
      }),
    );
  }
}
