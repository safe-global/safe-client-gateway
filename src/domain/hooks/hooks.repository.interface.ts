import { EventCacheHelperModule } from '@/domain/hooks/helpers/event-cache.helper.module';
import { EventNotificationsHelperModule } from '@/domain/hooks/helpers/event-notifications.helper';
import {
  HooksRepository,
  HooksRepositoryWithNotifications,
} from '@/domain/hooks/hooks.repository';
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
  providers: [
    { provide: IHooksRepository, useClass: HooksRepositoryWithNotifications },
  ],
  exports: [IHooksRepository],
})
export class HooksRepositoryWithNotificationsModule {}

// TODO: Remove after notifications FF is enabled
// Note: trying to convert this into a dynamic module proved to be too complex
// due to config injection issues from the ConfigurationService so this is a
// temporary solution
@Module({
  imports: [EventCacheHelperModule, QueuesRepositoryModule],
  providers: [{ provide: IHooksRepository, useClass: HooksRepository }],
  exports: [IHooksRepository],
})
export class HooksRepositoryModule {}
