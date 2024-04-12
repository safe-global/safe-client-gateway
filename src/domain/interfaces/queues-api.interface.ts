import { ConsumeMessage } from 'amqplib';

export const IQueuesApi = Symbol('IQueuesApi');

export interface IQueuesApi {
  isReady(): boolean;
  subscribe(
    queueName: string,
    fn: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void>;
}
