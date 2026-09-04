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

@Injectable()
export class CloudCosignerRateLimitGuard extends RateLimitGuard {
  constructor(
    @Inject(IConfigurationService)
    readonly configurationService: IConfigurationService,
    @Inject(CacheService) cacheService: ICacheService,
    @Inject(LoggingService) loggingService: ILoggingService,
  ) {
    super(cacheService, loggingService, {
      max: configurationService.getOrThrow<number>(
        'cloudCosigner.rateLimit.max',
      ),
      windowSeconds: configurationService.getOrThrow<number>(
        'cloudCosigner.rateLimit.windowSeconds',
      ),
    });
  }
}
