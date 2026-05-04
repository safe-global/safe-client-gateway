// SPDX-License-Identifier: FSL-1.1-MIT
import type { QueueMessage } from '@/modules/queue/entities/message.entity';
import { buildOrigin } from '@/modules/queue/helpers/origin.helper';
import type { Message } from '@/modules/messages/domain/entities/message.entity';

export function mapQueueToMessage(msg: QueueMessage): Message {
  return {
    ...msg,
    origin: buildOrigin(msg.originName, msg.originUrl),
  };
}
