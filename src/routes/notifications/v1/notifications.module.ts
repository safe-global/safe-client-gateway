import { Module } from '@nestjs/common';
import { NotificationsController } from '@/routes/notifications/v1/notifications.controller';
import { NotificationsModuleV2 } from '@/routes/notifications/v2/notifications.module';

@Module({
  imports: [NotificationsModuleV2],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
