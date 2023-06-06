import { Inject, Injectable } from '@nestjs/common';
import { CacheRouter } from '../../datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '../../datasources/cache/cache.service.interface';
import { IConfigApi } from '../interfaces/config-api.interface';
import { InvalidationPatternDto } from './entities/invalidation-pattern.dto.entity';
import { InvalidationTarget } from './entities/invalidation-target.entity';
import { IFlushRepository } from './flush.repository.interface';
import {
  ILoggingService,
  LoggingService,
} from '../../logging/logging.interface';

@Injectable()
export class FlushRepository implements IFlushRepository {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
  ) {}

  async execute(pattern: InvalidationPatternDto): Promise<void> {
    switch (pattern.invalidate) {
      case InvalidationTarget[InvalidationTarget.Chains]:
        return this.invalidateChains();
      default:
        this.loggingService.debug(
          `Unknown flush pattern ${pattern.invalidate}`,
        );
    }
  }

  private async invalidateChains(): Promise<void> {
    await this.cacheService.deleteByKey(CacheRouter.getChainsCacheKey());
    const pattern = CacheRouter.getChainsCachePattern();
    await this.cacheService.deleteByKeyPattern(pattern);
  }
}
