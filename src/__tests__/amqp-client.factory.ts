import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import { Channel } from 'amqplib';

export async function amqpClientFactory(): Promise<{
  channel: ChannelWrapper;
  queueName: string;
}> {
  const { AMQP_URL, AMQP_EXCHANGE_NAME, AMQP_EXCHANGE_MODE, AMQP_QUEUE } =
    process.env;
  const connection = amqp.connect(AMQP_URL);
  const channel = connection.createChannel({
    json: true,
    setup: async (ch: Channel) => {
      await ch.assertExchange(AMQP_EXCHANGE_NAME!, AMQP_EXCHANGE_MODE!, {
        durable: true,
      });
      await ch.assertQueue(AMQP_QUEUE!, { durable: true });
      await ch.bindQueue(AMQP_QUEUE!, AMQP_EXCHANGE_NAME!, '');
    },
  });

  return { channel, queueName: AMQP_QUEUE! };
}
