import { IQueuesApiService } from '@/modules/queues/datasources/queues-api.service.interface';
import { IQueuesRepository } from '@/modules/queues/domain/queues-repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import { type ConsumeMessage } from 'amqplib';

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
