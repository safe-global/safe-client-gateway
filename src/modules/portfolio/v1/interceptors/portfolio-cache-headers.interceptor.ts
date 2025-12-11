import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import {
  IPortfolioCacheInfoService,
  type IPortfolioCacheInfoService as IPortfolioCacheInfoServiceType,
} from '@/modules/portfolio/domain/portfolio-cache-info.service';

@Injectable()
export class PortfolioCacheHeadersInterceptor implements NestInterceptor {
  constructor(
    @Inject(IPortfolioCacheInfoService)
    private readonly portfolioCacheInfoService: IPortfolioCacheInfoServiceType,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    const response: Response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      tap(() => {
        if (response.headersSent) {
          return;
        }

        const cacheInfo = this.portfolioCacheInfoService.getCacheInfo();
        if (!cacheInfo) {
          return;
        }

        const { cacheHit, ttlSeconds, maxAgeSeconds } = cacheInfo;
        const ageSeconds = Math.max(0, maxAgeSeconds - ttlSeconds);

        const existingCacheControl = response.getHeader('Cache-Control');
        if (existingCacheControl === 'no-cache' || !existingCacheControl) {
          response.setHeader(
            'Cache-Control',
            `public, max-age=${maxAgeSeconds}`,
          );
        }
        response.setHeader('Age', String(ageSeconds));
        response.setHeader('X-Cache-Status', cacheHit ? 'HIT' : 'MISS');
        response.setHeader('X-Cache-TTL', String(ttlSeconds));
      }),
    );
  }
}
