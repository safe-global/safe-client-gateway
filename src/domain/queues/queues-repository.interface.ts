import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { QueuesRepository } from '@/domain/queues/queues-repository';
import { Module, OnModuleInit } from '@nestjs/common';
import { Event } from '@/routes/cache-hooks/entities/event.entity';

export const IQueuesRepository = Symbol('IQueuesRepository');

export interface IQueuesRepository extends OnModuleInit {
  /**
   * Subscribes to {@link Event}s.
   *
   * @param onEvent - Callback to be executed when an {@link Event} is received.
   */
  onEvent(listener: (event: Event) => Promise<unknown>): void;
}

@Module({
  imports: [QueuesApiModule],
  providers: [{ provide: IQueuesRepository, useClass: QueuesRepository }],
  exports: [IQueuesRepository],
})
export class QueuesRepositoryModule {}
