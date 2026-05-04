// SPDX-License-Identifier: FSL-1.1-MIT
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { QueueDelegate } from '@/modules/queue/entities/delegate.entity';

/**
 * Maps a queue service QueueDelegate to the domain delegate shape,
 * preserving the nullable label from the upstream response.
 */
export function mapQueueToDelegate(d: QueueDelegate): Delegate {
  return {
    ...d,
    label: d.label ?? '',
  };
}
