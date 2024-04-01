import { IQueueConsumerService } from '@/datasources/queues/queue-consumer.service.interface';

export class QueueConsumerService implements IQueueConsumerService {
  async subscribe(fn: (msg: string) => Promise<void>): Promise<void> {
    await fn('not implemented');
  }
}
