import { IConfigurationService } from '@/config/configuration.service.interface';
import { QueueApiService } from '@/modules/queues/datasources/queues-api.service';
import { IQueuesApiService } from '@/modules/queues/datasources/queues-api.service.interface';
import { QueuesApiShutdownHook } from '@/modules/queues/datasources/queues-api.shutdown.hook';
import { QueueReadiness } from '@/domain/interfaces/queue-readiness.interface';
import { Module } from '@nestjs/common';
import amqp, {
  type AmqpConnectionManager,
  type ChannelWrapper,
} from 'amqp-connection-manager';
import { type Channel } from 'amqplib';

export interface QueueConsumer {
  connection: AmqpConnectionManager;
  channel: ChannelWrapper;
}

function queueConsumerFactory(
  configurationService: IConfigurationService,
): QueueConsumer {
  const amqpUrl = configurationService.getOrThrow<string>('amqp.url');
  const exchangeName =
    configurationService.getOrThrow<string>('amqp.exchange.name');
  const exchangeMode =
    configurationService.getOrThrow<string>('amqp.exchange.mode');
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
      await ch.assertExchange(exchangeName, exchangeMode, { durable: true });
      await ch.assertQueue(queue, { durable: true });
      // Note: Using consumer (not channel) prefetch (https://www.rabbitmq.com/docs/consumer-prefetch)
      await ch.prefetch(prefetch);
      await ch.bindQueue(queue, exchangeName, '');
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
