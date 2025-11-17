import { Module } from '@nestjs/common';
import { NotificationsController } from '@/modules/notifications/routes/v1/notifications.controller';
import { NotificationsModuleV2 } from '@/modules/notifications/routes/v2/notifications.module';

@Module({
  imports: [NotificationsModuleV2],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
