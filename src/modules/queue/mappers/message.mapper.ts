// SPDX-License-Identifier: FSL-1.1-MIT

import type { Message } from '@/modules/messages/domain/entities/message.entity';
import type { QueueMessage } from '@/modules/queue/entities/message.entity';
import { buildOrigin } from '@/modules/queue/helpers/origin.helper';

export function mapQueueMessageToMessage(msg: QueueMessage): Message {
  return {
    ...msg,
    origin: buildOrigin(msg.originName, msg.originUrl),
  };
}
