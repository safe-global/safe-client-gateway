import { QueueConsumer } from '@/datasources/queues/queue-consumer.module';
import { IQueueConsumerService } from '@/datasources/queues/queue-consumer.service.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Inject } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

export class QueueConsumerService implements IQueueConsumerService {
  constructor(
    @Inject('QueueConsumer') private readonly consumer: QueueConsumer,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  isReady(): boolean {
    return this.consumer.connection.isConnected();
  }

  async subscribe(
    queueName: string,
    fn: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void> {
    await this.consumer.channel.consume(queueName, async (msg) => {
      await fn(msg);
      await this.consumer.channel.ack(msg);
    });
    this.loggingService.info(`Subscribed to queue: ${queueName}`);
  }
}
