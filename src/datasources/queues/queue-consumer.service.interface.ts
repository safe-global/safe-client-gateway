import { ConsumeMessage } from 'amqplib';

export const IQueueConsumerService = Symbol('IQueueConsumerService');

export interface IQueueConsumerService {
  /**
   * Checks if the configured queue consumer is connected.
   */
  isReady(): boolean;

  subscribe(
    queueName: string,
    fn: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void>;
}
