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

@Injectable()
export class TokenApprovalsRateLimitGuard extends RateLimitGuard {
  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    @Inject(CacheService) cacheService: ICacheService,
    @Inject(LoggingService) loggingService: ILoggingService,
  ) {
    super(cacheService, loggingService, {
      max: configurationService.getOrThrow<number>(
        'tokenApprovals.rateLimit.max',
      ),
      windowSeconds: configurationService.getOrThrow<number>(
        'tokenApprovals.rateLimit.windowSeconds',
      ),
    });
  }
}
