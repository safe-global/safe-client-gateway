import { Module } from '@nestjs/common';
import { NotificationsController } from '@/routes/notifications/notifications.controller';
import { NotificationsService } from '@/routes/notifications/notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
