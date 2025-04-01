import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { RateLimitGuard } from '@/routes/common/guards/rate-limit.guard';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SpacesRateLimitGuard extends RateLimitGuard {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheService) cacheService: ICacheService,
    @Inject(LoggingService) loggingService: ILoggingService,
  ) {
    super(cacheService, loggingService, {
      max: configurationService.getOrThrow<number>('spaces.rateLimit.max'),
      windowSeconds: configurationService.getOrThrow<number>(
        'spaces.rateLimit.windowSeconds',
      ),
    });
  }
}
