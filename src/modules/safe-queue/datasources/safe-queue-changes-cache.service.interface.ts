// SPDX-License-Identifier: FSL-1.1-MIT
import type { SafeQueueChangeKey } from '#/modules/safe-queue/domain/entities/safe-queue-change.entity';
import type { Raw } from '#/validation/entities/raw.entity';

export const ISafeQueueChangesCacheService = Symbol(
  'ISafeQueueChangesCacheService',
);

/** Stores when the queue or the messages of a Safe changed, in the cache. */
export interface ISafeQueueChangesCacheService {
  getChangedAt(args: SafeQueueChangeKey): Promise<Raw<string> | null>;

  /** Kept for the default cache TTL from the first write of the key. */
  setChangedAt(args: SafeQueueChangeKey & { changedAt: Date }): Promise<void>;
}
