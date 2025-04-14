import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';

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
    const req: Request = context.switchToHttp().getRequest();
    const { success: isValidIp } = z.string().ip().safeParse(req.ip);
    if (!isValidIp) {
      this.logInvalidIp(req);
      throw new BadRequestException('Invalid client IP address');
    }
    const currentRequest = await this.cacheService.increment(
      CacheRouter.getRateLimitCacheKey(
        `${req.route.path}_${req.method}_${req.ip}`,
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

  private logInvalidIp(req: Request): void {
    this.loggingService.warn({
      type: LogType.InvalidIp,
      method: req.method,
      route: req.route.path,
      clientIp: req.ip,
    });
  }

  private logRateLimitHit(args: {
    req: Request;
    currentRequest: number;
  }): void {
    this.loggingService.warn({
      type: LogType.RateLimit,
      method: args.req.method,
      route: args.req.route.path,
      clientIp: args.req.ip,
      maxRequests: this.rateLimit.max,
      windowSeconds: this.rateLimit.windowSeconds,
      currentRequest: args.currentRequest,
    });
  }
}
