// SPDX-License-Identifier: FSL-1.1-MIT
import type { QueueMessage } from '@/datasources/queue-service-api/entities/queue-message.entity';
import type { QueueMessageConfirmation } from '@/datasources/queue-service-api/entities/queue-message.entity';
import type { MessageConfirmation } from '@/modules/messages/domain/entities/message-confirmation.entity';
import type { Message } from '@/modules/messages/domain/entities/message.entity';

function mapMessageConfirmation(
  confirmation: QueueMessageConfirmation,
): MessageConfirmation {
  return {
    created: confirmation.created,
    modified: confirmation.modified,
    owner: confirmation.owner,
    signature: confirmation.signature,
    signatureType: confirmation.signatureType,
  };
}

/**
 * Maps a queue service Message to the CGW Message type.
 */
export function mapQueueToMessage(queue: QueueMessage): Message {
  return {
    created: queue.created,
    modified: queue.modified,
    safe: queue.safe,
    messageHash: queue.messageHash,
    message: queue.message,
    proposedBy: queue.proposedBy,
    safeAppId: null,
    confirmations: queue.confirmations.map(mapMessageConfirmation),
    preparedSignature: queue.preparedSignature,
    origin: JSON.stringify({
      name: queue.originName,
      url: queue.originUrl,
    }),
  };
}
