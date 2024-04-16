import { IQueuesApiService } from '@/datasources/queues/queues-api.service.interface';
import { IQueuesRepository } from '@/domain/queues/queues-repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

@Injectable()
export class QueuesRepository implements IQueuesRepository {
  constructor(
    @Inject(IQueuesApiService) private readonly queuesApi: IQueuesApiService,
  ) {}

  async subscribe(
    queueName: string,
    fn: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void> {
    return this.queuesApi.subscribe(queueName, fn);
  }
}
