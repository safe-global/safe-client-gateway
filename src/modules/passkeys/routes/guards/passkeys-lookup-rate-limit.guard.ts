// SPDX-License-Identifier: FSL-1.1-MIT
import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { canActivateWithRateLimitHeaders } from '@/modules/passkeys/routes/guards/with-rate-limit-headers';
import { RateLimitGuard } from '@/routes/common/guards/rate-limit.guard';

@Injectable()
export class PasskeysLookupRateLimitGuard extends RateLimitGuard {
  private readonly windowSeconds: number;

  public constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    @Inject(CacheService) cacheService: ICacheService,
    @Inject(LoggingService) loggingService: ILoggingService,
  ) {
    const rateLimits = {
      max: configurationService.getOrThrow<number>(
        'passkeys.rateLimit.lookup.max',
      ),
      windowSeconds: configurationService.getOrThrow<number>(
        'passkeys.rateLimit.lookup.windowSeconds',
      ),
    };
    super(cacheService, loggingService, rateLimits);
    this.windowSeconds = rateLimits.windowSeconds;
  }

  public override canActivate(context: ExecutionContext): Promise<boolean> {
    return canActivateWithRateLimitHeaders(
      { canActivate: (ctx) => super.canActivate(ctx) } as RateLimitGuard,
      context,
      this.windowSeconds,
    );
  }
}
