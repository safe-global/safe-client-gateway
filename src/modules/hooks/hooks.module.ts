import { Module } from '@nestjs/common';
import { EventCacheHelperModule } from '@/modules/hooks/domain/helpers/event-cache.helper.module';
import { EventNotificationsHelperModule } from '@/modules/hooks/domain/helpers/event-notifications.helper';
import { HooksRepositoryModule } from '@/modules/hooks/domain/hooks.repository.interface';
import { HooksModule as HooksRoutesModule } from '@/modules/hooks/routes/hooks.module';

@Module({
  imports: [
    EventCacheHelperModule,
    EventNotificationsHelperModule,
    HooksRepositoryModule,
    HooksRoutesModule,
  ],
})
export class HooksModule {}
