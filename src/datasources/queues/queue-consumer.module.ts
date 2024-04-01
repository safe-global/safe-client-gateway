import { IConfigurationService } from '@/config/configuration.service.interface';
import { Module } from '@nestjs/common';
import amqp, {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import { Channel } from 'amqplib';

export interface QueueConsumer {
  connection: AmqpConnectionManager;
  channel: ChannelWrapper;
}

function queueConsumerFactory(
  configurationService: IConfigurationService,
): QueueConsumer {
  const amqpUrl = configurationService.getOrThrow<string>('amqp.url');
  const exchange = configurationService.getOrThrow<string>('amqp.exchange');
  const queue = configurationService.getOrThrow<string>('amqp.queue');
  const prefetch = configurationService.getOrThrow<number>('amqp.prefetch');
  const connection = amqp.connect(amqpUrl);
  const channel = connection.createChannel({
    json: true,
    setup: async (ch: Channel) => {
      await ch.assertQueue(queue, { durable: true });
      await ch.prefetch(prefetch);
      await ch.bindQueue(queue, exchange, '');
    },
  });
  return { connection, channel };
}

@Module({
  providers: [
    {
      provide: 'QueueConsumer',
      useFactory: queueConsumerFactory,
      inject: [IConfigurationService],
    },
    // TODO: hooks
  ],
})
export class QueueConsumerModule {}
