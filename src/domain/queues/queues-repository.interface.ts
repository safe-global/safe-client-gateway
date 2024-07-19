import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { QueuesRepository } from '@/domain/queues/queues-repository';
import { Module } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

export const IQueuesRepository = Symbol('IQueuesRepository');

export interface IQueuesRepository {
  /**
   * Subscribes to messages from the specified queue.
   *
   * @param queueName - The name of the queue to subscribe to.
   * @param fn - The callback function to be executed when a new message is received.
   * @returns {Promise<void>} A Promise that resolves when the subscription is successful.
   */
  subscribe(
    queueName: string,
    fn: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void>;
}

@Module({
  imports: [QueuesApiModule],
  providers: [{ provide: IQueuesRepository, useClass: QueuesRepository }],
  exports: [IQueuesRepository],
})
export class QueuesRepositoryModule {}
