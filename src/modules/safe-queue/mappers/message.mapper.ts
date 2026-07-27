// SPDX-License-Identifier: FSL-1.1-MIT

import type { Message } from '@/modules/messages/domain/entities/message.entity';
import type { SafeQueueMessage } from '@/modules/safe-queue/entities/message.entity';
import { buildOrigin } from '@/modules/safe-queue/helpers/origin.helper';

export function mapSafeQueueMessageToMessage(msg: SafeQueueMessage): Message {
  // Pick only domain fields explicitly. Spreading `msg` would leak queue-only
  // fields (chainId, originName, originUrl) onto an object typed as `Message`
  // — TypeScript does not flag them because object spread bypasses excess
  // property checks.
  return {
    created: msg.created,
    modified: msg.modified,
    safe: msg.safe,
    messageHash: msg.messageHash,
    message: msg.message,
    proposedBy: msg.proposedBy,
    confirmations: msg.confirmations,
    preparedSignature: msg.preparedSignature,
    origin: buildOrigin(msg.originName, msg.originUrl),
  };
}
