import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/notifications.repository.v2.interface';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { NotificationsControllerV2 } from '@/routes/notifications/notifications.controller.v2';
import { NotificationsServiceV2 } from '@/routes/notifications/notifications.service.v2';
import { Module } from '@nestjs/common';

@Module({
  imports: [NotificationsRepositoryV2Module, AuthRepositoryModule],
  controllers: [NotificationsControllerV2],
  providers: [NotificationsServiceV2, AuthGuard],
})
export class NotificationsModuleV2 {}
