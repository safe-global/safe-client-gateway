// SPDX-License-Identifier: FSL-1.1-MIT
import type { OffchainMessage } from '@/modules/offchain/entities/message.entity';
import type { OffchainMessageConfirmation } from '@/modules/offchain/entities/message.entity';
import type { MessageConfirmation } from '@/modules/messages/domain/entities/message-confirmation.entity';
import type { Message } from '@/modules/messages/domain/entities/message.entity';

function mapMessageConfirmation(
  confirmation: OffchainMessageConfirmation,
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
export function mapOffchainToMessage(queue: OffchainMessage): Message {
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
