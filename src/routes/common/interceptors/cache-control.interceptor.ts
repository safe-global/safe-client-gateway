import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import crypto from 'crypto';
import { ResponseCacheService } from '@/datasources/cache/response-cache.service';

/**
 * This interceptor can be used to set the `Cache-Control` header to `no-cache`.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly responseCacheService: ResponseCacheService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    return next.handle().pipe(
      tap((body) => {
        const response: Response = context.switchToHttp().getResponse();
        if (response.headersSent) {
          return;
        }

        if (response.getHeader('Cache-Control')) {
          return;
        }

        const ttl = this.responseCacheService.getTtl();

        if (ttl && ttl > 0) {
          response.header(
            'Cache-Control',
            `public, max-age=${ttl}, must-revalidate`,
          );
          response.header(
            'Expires',
            new Date(Date.now() + ttl * 1000).toUTCString(),
          );

          this.setEtag(response, body);
        } else {
          response.header('Cache-Control', 'no-cache');
        }
      }),
    );
  }

  private setEtag(response: Response, body: unknown): void {
    if (response.getHeader('ETag')) {
      return;
    }

    const payload = this.serializeBody(body);
    if (!payload) {
      return;
    }

    const etag = crypto.createHash('sha256').update(payload).digest('hex');
    response.header('ETag', `"${etag}"`);
  }

  private serializeBody(body: unknown): string | undefined {
    if (body === undefined || body === null) {
      return undefined;
    }

    if (typeof body === 'string') {
      return body;
    }

    if (Buffer.isBuffer(body)) {
      return body.toString('utf8');
    }

    try {
      return JSON.stringify(body);
    } catch {
      return undefined;
    }
  }
}
