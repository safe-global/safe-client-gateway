// SPDX-License-Identifier: FSL-1.1-MIT
import type { OffchainMessage } from '@/modules/offchain/entities/message.entity';
import { buildOrigin } from '@/modules/offchain/helpers/origin.helper';
import type { Message } from '@/modules/messages/domain/entities/message.entity';

/**
 * Maps a queue service Message to the CGW Message type.
 *
 * Message confirmations are identical in shape between the queue service
 * and CGW, so no per-confirmation mapping is needed.
 */
export function mapOffchainToMessage(msg: OffchainMessage): Message {
  return {
    ...msg,
    safeAppId: null,
    origin: buildOrigin(msg.originName, msg.originUrl),
    confirmations: msg.confirmations,
  };
}
