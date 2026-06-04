// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { EventCacheHelperModule } from '@/modules/hooks/domain/helpers/event-cache.helper.module';
import { HooksRepository } from '@/modules/hooks/domain/hooks.repository';
import { IHooksRepository } from '@/modules/hooks/domain/hooks.repository.interface';
import { HooksController } from '@/modules/hooks/routes/hooks.controller';
import { HooksService } from '@/modules/hooks/routes/hooks.service';
import { PushNotificationModule } from '@/modules/notifications/domain/push/push-notification.module';
import { QueuesRepositoryModule } from '../queues/domain/queues-repository.interface';

@Module({
  imports: [
    EventCacheHelperModule,
    PushNotificationModule,
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
