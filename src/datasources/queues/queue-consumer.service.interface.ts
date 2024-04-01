export interface IQueueConsumerService {
  subscribe(fn: (msg: string) => Promise<void>): Promise<void>;
}
