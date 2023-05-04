import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CacheRouter } from '../../datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '../../datasources/cache/cache.service.interface';
import { IConfigApi } from '../interfaces/config-api.interface';
import { InvalidationPatternDto } from './entities/invalidation-pattern.dto.entity';
import { InvalidationTarget } from './entities/invalidation-target.entity';
import { IFlushRepository } from './flush.repository.interface';

@Injectable()
export class FlushRepository implements IFlushRepository {
  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
  ) {}

  async execute(pattern: InvalidationPatternDto): Promise<void> {
    switch (pattern.invalidate) {
      case InvalidationTarget[InvalidationTarget.Chains]:
        return this.invalidateChains();
      case InvalidationTarget[InvalidationTarget.Contracts]:
        return this.invalidateContracts();
      case InvalidationTarget[InvalidationTarget.Tokens]:
        return this.invalidateTokens(pattern);
    }
  }

  private async invalidateChains(): Promise<void> {
    await this.cacheService.deleteByKey(CacheRouter.getChainsCacheKey());
    const pattern = CacheRouter.getChainsCachePattern();
    await this.cacheService.deleteByKeyPattern(pattern);
  }

  private async invalidateContracts(): Promise<void> {
    const pattern = CacheRouter.getContractsCachePattern();
    await this.cacheService.deleteByKeyPattern(pattern);
  }

  private async invalidateTokens(
    invalidationPatternDto: InvalidationPatternDto,
  ): Promise<void> {
    const chainId = invalidationPatternDto?.patternDetails?.chainId;
    if (!chainId) {
      throw new UnprocessableEntityException(`Chain id parameter is required`);
    }
    await this.cacheService.deleteByKey(CacheRouter.getTokensCacheKey(chainId));
    const pattern = CacheRouter.getTokensCachePattern(chainId);
    await this.cacheService.deleteByKeyPattern(pattern);
  }
}
