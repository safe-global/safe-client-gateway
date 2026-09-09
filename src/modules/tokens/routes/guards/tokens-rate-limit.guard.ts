// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { RateLimitGuard } from '@/routes/common/guards/rate-limit.guard';

/**
 * Per-caller bound for the unauthenticated token metadata routes. The batch route turns one
 * request into up to `MAX_TOKEN_ADDRESSES` upstream lookups, so its own limit is kept separate
 * from every other endpoint's.
 */
@Injectable()
export class TokensRateLimitGuard extends RateLimitGuard {
  constructor(
    @Inject(IConfigurationService)
    readonly configurationService: IConfigurationService,
    @Inject(CacheService) cacheService: ICacheService,
    @Inject(LoggingService) loggingService: ILoggingService,
  ) {
    const rateLimits = {
      max: configurationService.getOrThrow<number>('tokens.rateLimit.max'),
      windowSeconds: configurationService.getOrThrow<number>(
        'tokens.rateLimit.windowSeconds',
      ),
    };
    super(cacheService, loggingService, rateLimits);
  }
}
