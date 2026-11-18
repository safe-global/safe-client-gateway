// SPDX-License-Identifier: FSL-1.1-MIT
import type { SafeQueueChangeKey } from '#/modules/safe-queue/domain/entities/safe-queue-change.entity';

export const ISafeQueueChangesRepository = Symbol(
  'ISafeQueueChangesRepository',
);

/**
 * When the transaction queue or the messages of a Safe last changed, as
 * recorded from Queue Service events and from writes made through CGW.
 * `txQueuedTag` and `messagesTag` are served from it.
 */
export interface ISafeQueueChangesRepository {
  /**
   * Null when no change was recorded within the default cache TTL of the first
   * record, when it cannot be read, or when the Queue Service is off: the
   * caller then derives the time from the queue or the messages themselves.
   */
  getChangedAt(args: SafeQueueChangeKey): Promise<Date | null>;

  /**
   * Stores one second after the stored time when that one is the same or
   * later, so every change moves the tag forward and a late event never
   * takes the tag back. Best-effort: a failure is logged, as the tag then
   * falls back to the queue or the messages themselves.
   */
  setChangedAt(args: SafeQueueChangeKey & { changedAt: Date }): Promise<void>;
}
