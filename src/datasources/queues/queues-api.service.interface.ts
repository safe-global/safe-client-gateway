import { ConsumeMessage } from 'amqplib';

export const IQueuesApiService = Symbol('IQueuesApiService');

export interface IQueuesApiService {
  subscribe(
    queueName: string,
    fn: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void>;
}
