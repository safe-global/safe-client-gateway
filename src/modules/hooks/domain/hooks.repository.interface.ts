import { EventCacheHelperModule } from '@/modules/hooks/domain/helpers/event-cache.helper.module';
import { EventNotificationsHelperModule } from '@/modules/hooks/domain/helpers/event-notifications.helper';
import { HooksRepository } from '@/modules/hooks/domain/hooks.repository';
import { QueuesRepositoryModule } from '@/modules/queues/domain/queues-repository.interface';
import { Event } from '@/modules/hooks/routes/entities/event.entity';
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
