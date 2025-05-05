import type { ChannelWrapper } from 'amqp-connection-manager';
import amqp from 'amqp-connection-manager';
import type { Channel } from 'amqplib';

export function amqpClientFactory(queue?: string): {
  channel: ChannelWrapper;
  queueName: string;
} {
  const {
    AMQP_URL,
    AMQP_EXCHANGE_NAME,
    AMQP_EXCHANGE_MODE,
    AMQP_QUEUE,
    AMQP_HEARBEAT_INTERVAL_SECONDS,
    AMQP_RECONNECT_TIME_SECONDS,
  } = process.env;

  const heartbeatIntervalInSeconds = +(AMQP_HEARBEAT_INTERVAL_SECONDS || 60);
  const reconnectTimeInSeconds = +(AMQP_RECONNECT_TIME_SECONDS || 5);

  if (!AMQP_URL || !AMQP_EXCHANGE_NAME || !AMQP_EXCHANGE_MODE || !AMQP_QUEUE) {
    throw new Error('Invalid amqpClientFactory configuration');
  }

  const queueName = queue ?? AMQP_QUEUE;
  const connection = amqp.connect(AMQP_URL, {
    heartbeatIntervalInSeconds,
    reconnectTimeInSeconds,
  });
  const channel = connection.createChannel({
    json: true,
    setup: async (ch: Channel) => {
      await ch.assertExchange(AMQP_EXCHANGE_NAME, AMQP_EXCHANGE_MODE, {
        durable: true,
      });
      await ch.assertQueue(queueName, { durable: true });
      await ch.bindQueue(queueName, AMQP_EXCHANGE_NAME, '');
    },
  });

  return { channel, queueName };
}
