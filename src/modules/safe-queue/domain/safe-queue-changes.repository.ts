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
  // The tags are served in whole seconds, so a smaller step could leave one
  // unchanged
  private static readonly MIN_TAG_STEP_MS = 1_000;
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
    // Every change moves the stored time forward: an event can arrive late or
    // carry a clock behind ours, and must neither take the tag back nor leave
    // it where a client already saw it
    const storedChangedAt = await this.getChangedAt(args);
    const changedAt =
      storedChangedAt && storedChangedAt >= args.changedAt
        ? new Date(
            storedChangedAt.getTime() +
              SafeQueueChangesRepository.MIN_TAG_STEP_MS,
          )
        : args.changedAt;
    try {
      await this.safeQueueChangesCacheService.setChangedAt({
        ...args,
        changedAt,
      });
    } catch (error) {
      this.loggingService.warn(
        `Failed to record when the ${args.change} changed. chainId=${args.chainId}, safeAddress=${args.safeAddress}, error=${asError(error).message}`,
      );
    }
  }
}
