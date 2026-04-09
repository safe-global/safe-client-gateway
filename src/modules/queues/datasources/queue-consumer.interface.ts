// SPDX-License-Identifier: FSL-1.1-MIT
import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';

export interface QueueConsumer {
  connection: AmqpConnectionManager;
  channel: ChannelWrapper;
}
