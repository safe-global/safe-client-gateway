import { ConsumeMessage } from 'amqplib';

export const IQueuesApiService = Symbol('IQueuesApiService');

export interface IQueuesApiService {
  /**
   * Sets an arbitrary {@link fn} function as a callback.
   * Every time a new message is received into the queue {@link queueName},
   * this callback function gets executed.
   *
   * @param queueName the queue name identifier
   * @param fn callback function called on every message reception
   */
  subscribe(
    queueName: string,
    fn: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void>;
}
