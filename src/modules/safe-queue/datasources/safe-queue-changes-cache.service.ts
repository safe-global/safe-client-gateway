// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import type { ISafeQueueChangesCacheService } from '#/modules/safe-queue/datasources/safe-queue-changes-cache.service.interface';
import type { SafeQueueChange } from '#/modules/safe-queue/domain/entities/safe-queue-change.entity';
import { type Raw, rawify } from '#/validation/entities/raw.entity';

@Injectable()
export class SafeQueueChangesCacheService
  implements ISafeQueueChangesCacheService
{
  private readonly expirationTimeInSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.expirationTimeInSeconds = this.configurationService.getOrThrow<number>(
      'expirationTimeInSeconds.default',
    );
  }

  async getChangedAt(args: {
    change: SafeQueueChange;
    chainId: string;
    safeAddress: Address;
  }): Promise<Raw<string> | null> {
    const changedAt = await this.cacheService.hGet(
      CacheRouter.getSafeQueueChangedAtCacheDir(args),
    );
    return changedAt === null ? null : rawify(changedAt);
  }

  async setChangedAt(args: {
    change: SafeQueueChange;
    chainId: string;
    safeAddress: Address;
    changedAt: Date;
  }): Promise<void> {
    await this.cacheService.hSet(
      CacheRouter.getSafeQueueChangedAtCacheDir(args),
      args.changedAt.toISOString(),
      this.expirationTimeInSeconds,
    );
  }
}
