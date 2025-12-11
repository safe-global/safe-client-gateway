import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { CacheInfo } from '@/modules/portfolio/domain/entities/cache-info.entity';

export const IPortfolioCacheInfoService = Symbol('IPortfolioCacheInfoService');

const PORTFOLIO_CACHE_INFO_KEY = 'portfolio_cache_info';

export interface IPortfolioCacheInfoService {
  setCacheInfo(cacheInfo: CacheInfo): void;
  getCacheInfo(): CacheInfo | null;
}

@Injectable()
export class PortfolioCacheInfoService implements IPortfolioCacheInfoService {
  constructor(private readonly cls: ClsService) {}

  setCacheInfo(cacheInfo: CacheInfo): void {
    this.cls.set(PORTFOLIO_CACHE_INFO_KEY, cacheInfo);
  }

  getCacheInfo(): CacheInfo | null {
    return this.cls.get<CacheInfo>(PORTFOLIO_CACHE_INFO_KEY) ?? null;
  }
}
