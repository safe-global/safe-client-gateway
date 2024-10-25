import { QueueConsumer } from '@/datasources/queues/queues-api.module';
import { IQueuesApiService } from '@/datasources/queues/queues-api.service.interface';
import { IQueueReadiness } from '@/domain/interfaces/queue-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Inject } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

export class QueueApiService implements IQueuesApiService, IQueueReadiness {
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
    await this.consumer.channel.consume(queueName, (msg: ConsumeMessage) => {
      // Note: each message is explicitly acknowledged at this point, regardless the callback execution result.
      // The callback is expected to handle any errors and/or retries. Messages are not re-enqueued on error.
      void fn(msg).finally(() => this.consumer.channel.ack(msg));
    });
    this.loggingService.info(`Subscribed to queue: ${queueName}`);
  }
}
