import { Module } from '@nestjs/common';
import { EventCacheHelperModule } from '@/modules/hooks/domain/helpers/event-cache.helper.module';
import { EventNotificationsHelperModule } from '@/modules/hooks/domain/helpers/event-notifications.helper';
import { HooksRepository } from '@/modules/hooks/domain/hooks.repository';
import { IHooksRepository } from '@/modules/hooks/domain/hooks.repository.interface';
import { HooksController } from '@/modules/hooks/routes/hooks.controller';
import { HooksService } from '@/modules/hooks/routes/hooks.service';
import { QueuesRepositoryModule } from '../queues/domain/queues-repository.interface';

@Module({
  imports: [
    EventCacheHelperModule,
    EventNotificationsHelperModule,
    QueuesRepositoryModule,
  ],
  controllers: [HooksController],
  providers: [
    { provide: IHooksRepository, useClass: HooksRepository },
    HooksService,
  ],
  exports: [IHooksRepository],
})
export class HooksModule {}
