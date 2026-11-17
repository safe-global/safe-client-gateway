// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import type { SafeQueueChange } from '#/modules/safe-queue/domain/entities/safe-queue-change.entity';
import type { ISafeQueueChangesRepository } from '#/modules/safe-queue/domain/safe-queue-changes.repository.interface';
import { NullableCoercedDateSchema } from '#/validation/entities/schemas/nullable.schema';

@Injectable()
export class SafeQueueChangesRepository implements ISafeQueueChangesRepository {
  private readonly safeQueueEnabled: boolean;
  private readonly expirationTimeInSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.safeQueueEnabled = this.configurationService.getOrThrow<boolean>(
      'features.safeQueueService',
    );
    this.expirationTimeInSeconds = this.configurationService.getOrThrow<number>(
      'expirationTimeInSeconds.default',
    );
  }

  async getChangedAt(args: {
    change: SafeQueueChange;
    chainId: string;
    safeAddress: Address;
  }): Promise<Date | null> {
    if (!this.safeQueueEnabled) {
      return null;
    }
    try {
      const changedAt = await this.cacheService.hGet(
        CacheRouter.getSafeQueueChangedAtCacheDir(args),
      );
      return NullableCoercedDateSchema.parse(changedAt);
    } catch (error) {
      this.loggingService.warn(
        `Failed to read when the ${args.change} changed. chainId=${args.chainId}, safeAddress=${args.safeAddress}, error=${asError(error).message}`,
      );
      return null;
    }
  }

  async setChangedAt(args: {
    change: SafeQueueChange;
    chainId: string;
    safeAddress: Address;
    changedAt: Date;
  }): Promise<void> {
    if (!this.safeQueueEnabled) {
      return;
    }
    try {
      await this.cacheService.hSet(
        CacheRouter.getSafeQueueChangedAtCacheDir(args),
        args.changedAt.toISOString(),
        this.expirationTimeInSeconds,
      );
    } catch (error) {
      this.loggingService.warn(
        `Failed to record when the ${args.change} changed. chainId=${args.chainId}, safeAddress=${args.safeAddress}, error=${asError(error).message}`,
      );
    }
  }
}
