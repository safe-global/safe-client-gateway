// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '#/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { ISafeQueueChangesCacheService } from '#/modules/safe-queue/datasources/safe-queue-changes-cache.service.interface';
import type { SafeQueueChangeKey } from '#/modules/safe-queue/domain/entities/safe-queue-change.entity';
import type { ISafeQueueChangesRepository } from '#/modules/safe-queue/domain/safe-queue-changes.repository.interface';
import { NullableCoercedDateSchema } from '#/validation/entities/schemas/nullable.schema';

@Injectable()
export class SafeQueueChangesRepository implements ISafeQueueChangesRepository {
  private readonly safeQueueEnabled: boolean;

  constructor(
    @Inject(ISafeQueueChangesCacheService)
    private readonly safeQueueChangesCacheService: ISafeQueueChangesCacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.safeQueueEnabled = this.configurationService.getOrThrow<boolean>(
      'features.safeQueueService',
    );
  }

  async getChangedAt(args: SafeQueueChangeKey): Promise<Date | null> {
    if (!this.safeQueueEnabled) {
      return null;
    }
    try {
      const changedAt =
        await this.safeQueueChangesCacheService.getChangedAt(args);
      return NullableCoercedDateSchema.parse(changedAt);
    } catch (error) {
      this.loggingService.warn(
        `Failed to read when the ${args.change} changed. chainId=${args.chainId}, safeAddress=${args.safeAddress}, error=${asError(error).message}`,
      );
      return null;
    }
  }

  async setChangedAt(
    args: SafeQueueChangeKey & { changedAt: Date },
  ): Promise<void> {
    if (!this.safeQueueEnabled) {
      return;
    }
    // Events are handled concurrently and can arrive late, so an older change
    // must not take the tag back to a value a client already holds
    const storedChangedAt = await this.getChangedAt(args);
    if (storedChangedAt && storedChangedAt >= args.changedAt) {
      return;
    }
    try {
      await this.safeQueueChangesCacheService.setChangedAt(args);
    } catch (error) {
      this.loggingService.warn(
        `Failed to record when the ${args.change} changed. chainId=${args.chainId}, safeAddress=${args.safeAddress}, error=${asError(error).message}`,
      );
    }
  }
}
