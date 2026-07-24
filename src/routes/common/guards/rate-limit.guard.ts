// SPDX-License-Identifier: FSL-1.1-MIT
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { z } from 'zod';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  getRoutePath,
  type HttpRequest,
} from '@/routes/common/http/http-request.utils';

/**
 * RateLimitGuard is a guard that limits the number of requests
 * a client can make to a specific route within a given time window.
 * It uses a cache service to track the number of requests made by each client.
 * If the limit is exceeded, it throws an HttpException with a 429 status code.
 */
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly cacheService: ICacheService,
    private readonly loggingService: ILoggingService,
    private rateLimit: { max: number; windowSeconds: number },
  ) {
    this.rateLimit = rateLimit;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const { success: isValidIp } = z
      .union([z.ipv4(), z.ipv6()])
      .safeParse(req.ip);
    if (!isValidIp) {
      this.logInvalidIp(req);
      throw new BadRequestException('Invalid client IP address');
    }
    const currentRequest = await this.cacheService.increment(
      CacheRouter.getRateLimitCacheKey(
        `${getRoutePath(req)}_${req.method}_${req.ip}`,
      ),
      this.rateLimit.windowSeconds,
    );
    if (currentRequest > this.rateLimit.max) {
      this.logRateLimitHit({ req, currentRequest });
      throw new HttpException(
        'Rate limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private logInvalidIp(req: HttpRequest): void {
    this.loggingService.warn({
      type: LogType.InvalidIp,
      method: req.method,
      route: getRoutePath(req),
      clientIp: req.ip,
    });
  }

  private logRateLimitHit(args: {
    req: HttpRequest;
    currentRequest: number;
  }): void {
    this.loggingService.warn({
      type: LogType.RateLimit,
      method: args.req.method,
      route: getRoutePath(args.req),
      clientIp: args.req.ip,
      maxRequests: this.rateLimit.max,
      windowSeconds: this.rateLimit.windowSeconds,
      currentRequest: args.currentRequest,
    });
  }
}
