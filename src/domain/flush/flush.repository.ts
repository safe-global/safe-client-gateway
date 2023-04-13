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
    const chains = await this.configApi.getChains();
    await this.cacheService.delete(CacheRouter.getChainsCacheDir());
    await Promise.all(
      chains.results.map((chain) =>
        this.cacheService.delete(CacheRouter.getChainCacheDir(chain.chainId)),
      ),
    );
  }

  private async invalidateContracts(): Promise<void> {
    const chains = await this.configApi.getChains();
    await Promise.all(
      chains.results.map((chain) =>
        this.cacheService.delete(
          CacheRouter.getContractCacheDir(chain.chainId, ''),
        ),
      ),
    );
  }

  private async invalidateTokens(
    pattern: InvalidationPatternDto,
  ): Promise<void> {
    const chainId = pattern?.patternDetails?.chainId;
    if (!chainId) {
      throw new UnprocessableEntityException(`Chain id parameter is required`);
    }
    await this.cacheService.delete(CacheRouter.getTokensCacheDir(chainId));
    await this.cacheService.delete(CacheRouter.getTokenCacheDir(chainId, ''));
  }
}
