import { ConsumeMessage } from 'amqplib';

export const IQueueConsumerService = Symbol('IQueueConsumerService');

export interface IQueueConsumerService {
  subscribe(
    queueName: string,
    fn: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void>;
}
