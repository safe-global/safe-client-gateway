// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '#/config/configuration.service.interface';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { RateLimitGuard } from '#/routes/common/guards/rate-limit.guard';

/**
 * Rate limit for the portfolio cache clear. Each clear makes the next read of
 * that Safe a paid Zerion call, so a client cannot clear without bound.
 */
@Injectable()
export class PortfolioClearRateLimitGuard extends RateLimitGuard {
  constructor(
    // Read only to build `rateLimits` below, never after construction.
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(CacheService) cacheService: ICacheService,
    @Inject(LoggingService) loggingService: ILoggingService,
  ) {
    const rateLimits = {
      max: configurationService.getOrThrow<number>(
        'portfolio.clear.rateLimit.max',
      ),
      windowSeconds: configurationService.getOrThrow<number>(
        'portfolio.clear.rateLimit.windowSeconds',
      ),
    };
    super(cacheService, loggingService, rateLimits);
  }
}
