import { Module } from '@nestjs/common';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { NotificationsModule as NotificationsV1RoutesModule } from '@/modules/notifications/routes/v1/notifications.module';
import { NotificationsModuleV2 as NotificationsV2RoutesModule } from '@/modules/notifications/routes/v2/notifications.module';

@Module({
  imports: [
    NotificationsRepositoryV2Module,
    NotificationsV1RoutesModule,
    NotificationsV2RoutesModule,
  ],
})
export class NotificationsModule {}
