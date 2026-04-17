// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import type { IQueueReadiness } from '@/domain/interfaces/queue-readiness.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { QueueConsumer } from '@/modules/queues/datasources/queues-api.module';
import type { IQueuesApiService } from '@/modules/queues/datasources/queues-api.service.interface';

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
      fn(msg)
        .catch((error) => {
          this.loggingService.error(
            `Error processing message from queue ${queueName}: ${error.message}`,
          );
        })
        .finally(() => this.consumer.channel.ack(msg));
    });
    this.loggingService.info(`Subscribed to queue: ${queueName}`);
  }
}
