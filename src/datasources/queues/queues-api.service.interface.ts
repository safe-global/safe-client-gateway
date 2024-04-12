import { ConsumeMessage } from 'amqplib';

export const IQueuesApiService = Symbol('IQueuesApiService');

export interface IQueuesApiService {
  /**
   * Checks if the configured queue consumer is connected.
   */
  isReady(): boolean;

  subscribe(
    queueName: string,
    fn: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void>;
}
