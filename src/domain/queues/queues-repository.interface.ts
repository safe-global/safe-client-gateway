import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { QueuesRepository } from '@/domain/queues/queues-repository';
import { Module } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

export const IQueuesRepository = Symbol('IQueuesRepository');

export interface IQueuesRepository {
  isReady(): boolean;
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
