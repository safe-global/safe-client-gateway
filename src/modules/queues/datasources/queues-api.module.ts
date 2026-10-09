// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import amqp, {
  type AmqpConnectionManager,
  type ChannelWrapper,
} from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { QueueReadiness } from '@/domain/interfaces/queue-readiness.interface';
import { QueueApiService } from '@/modules/queues/datasources/queues-api.service';
import { IQueuesApiService } from '@/modules/queues/datasources/queues-api.service.interface';
import { QueuesApiShutdownHook } from '@/modules/queues/datasources/queues-api.shutdown.hook';

export interface QueueConsumer {
  connection: AmqpConnectionManager;
  channel: ChannelWrapper;
}

// The Safe Transaction Service publishes to a topic exchange with routing key
// `{chainId}.{type}.{address}`. `#` matches every event.
const ALL_EVENTS_ROUTING_KEY = '#';

export function queueConsumerFactory(
  configurationService: IConfigurationService,
): QueueConsumer {
  const amqpUrl = configurationService.getOrThrow<string>('amqp.url');
  const exchangeName =
    configurationService.getOrThrow<string>('amqp.exchange.name');
  const queue = configurationService.getOrThrow<string>('amqp.queue');
  const prefetch = configurationService.getOrThrow<number>('amqp.prefetch');
  const heartbeatIntervalInSeconds = configurationService.getOrThrow<number>(
    'amqp.heartbeatIntervalInSeconds',
  );
  const reconnectTimeInSeconds = configurationService.getOrThrow<number>(
    'amqp.reconnectTimeInSeconds',
  );

  const connection = amqp.connect(amqpUrl, {
    heartbeatIntervalInSeconds,
    reconnectTimeInSeconds,
  });
  const channel = connection.createChannel({
    json: true,
    setup: async (ch: Channel) => {
      // Must match the Safe Transaction Service declaration, otherwise the
      // broker rejects it with PRECONDITION_FAILED.
      await ch.assertExchange(exchangeName, 'topic', { durable: true });
      await ch.assertQueue(queue, { durable: true });
      // Note: Using consumer (not channel) prefetch (https://www.rabbitmq.com/docs/consumer-prefetch)
      await ch.prefetch(prefetch);
      await ch.bindQueue(queue, exchangeName, ALL_EVENTS_ROUTING_KEY);
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
    { provide: IQueuesApiService, useClass: QueueApiService },
    { provide: QueueReadiness, useExisting: IQueuesApiService },
    QueuesApiShutdownHook,
  ],
  exports: [IQueuesApiService, QueueReadiness],
})
export class QueuesApiModule {}
