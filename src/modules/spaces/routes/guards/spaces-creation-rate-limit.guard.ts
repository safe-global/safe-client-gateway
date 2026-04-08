// SPDX-License-Identifier: FSL-1.1-MIT
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
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SpacesCreationRateLimitGuard extends RateLimitGuard {
  constructor(
    @Inject(IConfigurationService)
    readonly configurationService: IConfigurationService,
    @Inject(CacheService) cacheService: ICacheService,
    @Inject(LoggingService) loggingService: ILoggingService,
  ) {
    const rateLimits = {
      max: configurationService.getOrThrow<number>(
        'spaces.rateLimit.creation.max',
      ),
      windowSeconds: configurationService.getOrThrow<number>(
        'spaces.rateLimit.creation.windowSeconds',
      ),
    };
    super(cacheService, loggingService, rateLimits);
  }
}
