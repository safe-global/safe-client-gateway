import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { QueueConsumerService } from '@/datasources/queues/queue-consumer.service';
import { IQueueConsumerService } from '@/datasources/queues/queue-consumer.service.interface';
import { QueueConsumerShutdownHook } from '@/datasources/queues/queue-consumer.shutdown.hook';
import { DynamicModule, Module } from '@nestjs/common';
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
  const exchangeName =
    configurationService.getOrThrow<string>('amqp.exchange.name');
  const exchangeMode =
    configurationService.getOrThrow<string>('amqp.exchange.mode');
  const queue = configurationService.getOrThrow<string>('amqp.queue');
  const prefetch = configurationService.getOrThrow<number>('amqp.prefetch');

  const connection = amqp.connect(amqpUrl);
  const channel = connection.createChannel({
    json: true,
    setup: async (ch: Channel) => {
      await ch.assertExchange(exchangeName, exchangeMode, { durable: true });
      await ch.assertQueue(queue, { durable: true });
      await ch.prefetch(prefetch);
      await ch.bindQueue(queue, exchangeName, '');
    },
  });
  return { connection, channel };
}

class MockQueueConsumerService implements IQueueConsumerService {
  isReady(): boolean {
    return true;
  }

  subscribe(): Promise<void> {
    return Promise.resolve();
  }
}

@Module({})
export class QueueConsumerModule {
  static register(configFactory = configuration): DynamicModule {
    const { eventsQueue: isEventsQueueEnabled } = configFactory()['features'];
    return {
      module: QueueConsumerModule,
      providers: [
        {
          provide: 'QueueConsumer',
          useFactory: queueConsumerFactory,
          inject: [IConfigurationService],
        },
        {
          provide: IQueueConsumerService,
          useClass: isEventsQueueEnabled
            ? QueueConsumerService
            : MockQueueConsumerService,
        },
        QueueConsumerShutdownHook,
      ],
      exports: [IQueueConsumerService],
    };
  }
}
