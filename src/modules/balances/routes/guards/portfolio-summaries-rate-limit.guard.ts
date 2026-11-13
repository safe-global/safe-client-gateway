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
 * Rate limit for the portfolio summaries route. Each request can fan out into
 * one paid Zerion call per Safe it names, so it keeps a budget of its own.
 */
@Injectable()
export class PortfolioSummariesRateLimitGuard extends RateLimitGuard {
  constructor(
    // Read only to build `rateLimits` below, never after construction.
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(CacheService) cacheService: ICacheService,
    @Inject(LoggingService) loggingService: ILoggingService,
  ) {
    const rateLimits = {
      max: configurationService.getOrThrow<number>(
        'portfolioSummaries.rateLimit.max',
      ),
      windowSeconds: configurationService.getOrThrow<number>(
        'portfolioSummaries.rateLimit.windowSeconds',
      ),
    };
    super(cacheService, loggingService, rateLimits);
  }
}
