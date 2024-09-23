import { Module } from '@nestjs/common';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { NotificationsServiceV2 } from '@/routes/notifications/v2/notifications.service';
import { NotificationsControllerV2 } from '@/routes/notifications/v2/notifications.controller';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/notifications.repository.v2.interface';

@Module({
  imports: [NotificationsRepositoryV2Module, AuthRepositoryModule],
  controllers: [NotificationsControllerV2],
  providers: [NotificationsServiceV2, AuthGuard],
})
export class NotificationsModuleV2 {}
