import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import type { ISiweApi } from '@/domain/interfaces/siwe-api.interface';

@Injectable()
export class SiweApi implements ISiweApi {
  private readonly nonceTtlInSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {
    this.nonceTtlInSeconds = this.configurationService.getOrThrow(
      'auth.nonceTtlSeconds',
    );
  }
  async storeNonce(nonce: string): Promise<void> {
    const cacheDir = CacheRouter.getAuthNonceCacheDir(nonce);
    await this.cacheService.hSet(cacheDir, nonce, this.nonceTtlInSeconds);
  }

  getNonce(nonce: string): Promise<string | null> {
    const cacheDir = CacheRouter.getAuthNonceCacheDir(nonce);
    return this.cacheService.hGet(cacheDir);
  }

  async clearNonce(nonce: string): Promise<void> {
    const cacheDir = CacheRouter.getAuthNonceCacheDir(nonce);
    await this.cacheService.deleteByKey(cacheDir.key);
  }
}
