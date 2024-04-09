import { Module } from '@nestjs/common';
import { NotificationsController } from '@/routes/notifications/notifications.controller';
import { NotificationsService } from '@/routes/notifications/notifications.service';
import { NotificationsRepositoryModule } from '@/domain/notifications/notifications.repository.interface';

@Module({
  imports: [NotificationsRepositoryModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
