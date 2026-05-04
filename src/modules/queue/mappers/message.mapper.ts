// SPDX-License-Identifier: FSL-1.1-MIT
import type { QueueMessage } from '@/modules/queue/entities/message.entity';
import { buildOrigin } from '@/modules/queue/helpers/origin.helper';
import type { Message } from '@/modules/messages/domain/entities/message.entity';

/**
 * Maps a queue service Message to the CGW Message type.
 *
 * Message confirmations are identical in shape between the queue service
 * and CGW, so no per-confirmation mapping is needed.
 */
export function mapQueueToMessage(msg: QueueMessage): Message {
  return {
    ...msg,
    safeAppId: null,
    origin: buildOrigin(msg.originName, msg.originUrl),
    confirmations: msg.confirmations,
  };
}
