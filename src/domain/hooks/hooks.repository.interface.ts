import { EventCacheHelperModule } from '@/domain/hooks/helpers/event-cache.helper.module';
import { EventNotificationsHelperModule } from '@/domain/hooks/helpers/event-notifications.helper';
import { HooksRepository } from '@/domain/hooks/hooks.repository';
import { QueuesRepositoryModule } from '@/domain/queues/queues-repository.interface';
import { Event } from '@/routes/hooks/entities/event.entity';
import { Module } from '@nestjs/common';

export const IHooksRepository = Symbol('IHooksRepository');

export interface IHooksRepository {
  onEvent(event: Event): Promise<unknown>;
}

@Module({
  imports: [
    EventCacheHelperModule,
    EventNotificationsHelperModule,
    QueuesRepositoryModule,
  ],
  providers: [{ provide: IHooksRepository, useClass: HooksRepository }],
  exports: [IHooksRepository],
})
export class HooksRepositoryModule {}
