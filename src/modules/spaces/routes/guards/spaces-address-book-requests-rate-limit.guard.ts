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
export class SpacesAddressBookRequestsRateLimitGuard extends RateLimitGuard {
  constructor(
    @Inject(IConfigurationService)
    readonly configurationService: IConfigurationService,
    @Inject(CacheService) cacheService: ICacheService,
    @Inject(LoggingService) loggingService: ILoggingService,
  ) {
    const rateLimits = {
      max: configurationService.getOrThrow<number>(
        'spaces.rateLimit.addressBookRequestCreation.max',
      ),
      windowSeconds: configurationService.getOrThrow<number>(
        'spaces.rateLimit.addressBookRequestCreation.windowSeconds',
      ),
    };
    super(cacheService, loggingService, rateLimits);
  }
}
