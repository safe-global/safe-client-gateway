import { Module } from '@nestjs/common';
import { NotificationsController } from '@/routes/notifications/v1/notifications.controller';
import { NotificationsService } from '@/routes/notifications/v1/notifications.service';
import { NotificationsRepositoryModule } from '@/domain/notifications/v1/notifications.repository.interface';

@Module({
  imports: [NotificationsRepositoryModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
